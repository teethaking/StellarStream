#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Vec,
};

mod errors;
mod storage;

use errors::Error;
use storage::DataKey;

#[cfg(test)]
mod test;

// ── Public types ──────────────────────────────────────────────────────────────

/// A recipient and their share in basis points (0–10000).
#[contracttype]
#[derive(Clone, Debug)]
pub struct Recipient {
    pub address: Address,
    pub share_bps: u32,
}

/// The protocol setting being changed by a quorum proposal.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum AdminAction {
    /// Update the protocol fee (basis points).
    UpdateFee(u32),
    /// Update the fee-collector / treasury address.
    UpdateCollector(Address),
}

/// A pending or executed quorum proposal.
#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub action: AdminAction,
    /// Addresses that have approved so far.
    pub approvals: Vec<Address>,
    pub executed: bool,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct SplitterV3;

#[contractimpl]
impl SplitterV3 {
    // ── Initialization ────────────────────────────────────────────────────────

    /// Called once by the factory. `owner` is the single-admin for #633 guards.
    /// `quorum_admins` must contain exactly 3 addresses for the quorum system.
    pub fn initialize(
        env: Env,
        owner: Address,
        token: Address,
        fee_bps: u32,
        treasury: Address,
        quorum_admins: Vec<Address>,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        owner.require_auth();

        env.storage().instance().set(&DataKey::Admin, &owner);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
        env.storage().instance().set(&DataKey::StrictMode, &false);
        env.storage().instance().set(&DataKey::NextProposalId, &0u64);
        env.storage().instance().set(&DataKey::QuorumAdmins, &quorum_admins);

        // Auto-verify the owner.
        Self::_set_verified(&env, &owner, true);
        for addr in quorum_admins.iter() {
            Self::_set_verified(&env, &addr, true);
        }

        Ok(())
    }

    // ── #633: Verification management (single-admin) ──────────────────────────

    pub fn set_verification_status(
        env: Env,
        user: Address,
        status: bool,
    ) -> Result<(), Error> {
        Self::_require_admin(&env)?;
        Self::_set_verified(&env, &user, status);
        env.events().publish((symbol_short!("verified"), user.clone()), status);
        Ok(())
    }

    pub fn set_strict_mode(env: Env, strict: bool) -> Result<(), Error> {
        Self::_require_admin(&env)?;
        env.storage().instance().set(&DataKey::StrictMode, &strict);
        Ok(())
    }

    // ── #634: Quorum — propose ────────────────────────────────────────────────

    /// Create a new proposal. Caller is automatically the first approver.
    /// Returns the new `proposal_id`.
    pub fn propose_change(
        env: Env,
        caller: Address,
        action: AdminAction,
    ) -> Result<u64, Error> {
        caller.require_auth();
        Self::_require_quorum_admin(&env, &caller)?;

        let id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextProposalId)
            .unwrap_or(0);

        let mut approvals: Vec<Address> = Vec::new(&env);
        approvals.push_back(caller);

        let proposal = Proposal { action, approvals, executed: false };
        env.storage().persistent().set(&DataKey::Proposal(id), &proposal);
        env.storage().instance().set(&DataKey::NextProposalId, &(id + 1));

        Ok(id)
    }

    // ── #634: Quorum — approve ────────────────────────────────────────────────

    /// Add caller's approval to an existing proposal.
    pub fn approve_proposal(
        env: Env,
        caller: Address,
        proposal_id: u64,
    ) -> Result<(), Error> {
        caller.require_auth();
        Self::_require_quorum_admin(&env, &caller)?;

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::ProposalNotFound)?;

        if proposal.executed {
            return Err(Error::AlreadyExecuted);
        }
        // Prevent double-vote.
        for existing in proposal.approvals.iter() {
            if existing == caller {
                return Err(Error::AlreadyApproved);
            }
        }

        proposal.approvals.push_back(caller);
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        Ok(())
    }

    // ── #634: Quorum — execute ────────────────────────────────────────────────

    /// Execute a proposal once it has >= 2 approvals.
    pub fn execute_proposal(
        env: Env,
        caller: Address,
        proposal_id: u64,
    ) -> Result<(), Error> {
        caller.require_auth();
        Self::_require_quorum_admin(&env, &caller)?;

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(Error::ProposalNotFound)?;

        if proposal.executed {
            return Err(Error::AlreadyExecuted);
        }
        if proposal.approvals.len() < 2 {
            return Err(Error::QuorumNotReached);
        }

        // Apply the state change.
        match proposal.action.clone() {
            AdminAction::UpdateFee(new_bps) => {
                env.storage().instance().set(&DataKey::FeeBps, &new_bps);
            }
            AdminAction::UpdateCollector(new_treasury) => {
                env.storage().instance().set(&DataKey::Treasury, &new_treasury);
            }
        }

        proposal.executed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (symbol_short!("settings"), proposal_id),
            proposal.action,
        );

        Ok(())
    }

    // ── Core: split ───────────────────────────────────────────────────────────

    pub fn split(
        env: Env,
        sender: Address,
        recipients: Vec<Recipient>,
        total_amount: i128,
    ) -> Result<(), Error> {
        sender.require_auth();

        let strict: bool = env
            .storage()
            .instance()
            .get(&DataKey::StrictMode)
            .unwrap_or(false);

        let mut bps_sum: u32 = 0;
        for r in recipients.iter() {
            bps_sum = bps_sum.checked_add(r.share_bps).ok_or(Error::Overflow)?;
        }
        if bps_sum != 10_000 {
            return Err(Error::InvalidSplit);
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let contract_addr = env.current_contract_address();
        token_client.transfer(&sender, &contract_addr, &total_amount);

        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0);
        let fee_amount = if fee_bps > 0 {
            let f = total_amount
                .checked_mul(fee_bps as i128)
                .ok_or(Error::Overflow)?
                / 10_000;
            let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
            if f > 0 {
                token_client.transfer(&contract_addr, &treasury, &f);
            }
            f
        } else {
            0
        };
        let distributable = total_amount.checked_sub(fee_amount).ok_or(Error::Overflow)?;

        if strict {
            for r in recipients.iter() {
                if !Self::is_verified(&env, r.address.clone()) {
                    return Err(Error::RecipientNotVerified);
                }
            }
            Self::_distribute(&env, &token_client, &contract_addr, &recipients, distributable)?;
        } else {
            let mut verified: Vec<Recipient> = Vec::new(&env);
            let mut verified_bps: u32 = 0;
            for r in recipients.iter() {
                if Self::is_verified(&env, r.address.clone()) {
                    verified_bps = verified_bps.checked_add(r.share_bps).ok_or(Error::Overflow)?;
                    verified.push_back(r);
                }
            }
            if verified.is_empty() {
                return Err(Error::NoVerifiedRecipients);
            }
            let mut scaled: Vec<Recipient> = Vec::new(&env);
            for r in verified.iter() {
                let new_bps = (r.share_bps as u64)
                    .checked_mul(10_000)
                    .ok_or(Error::Overflow)? as u32
                    / verified_bps;
                scaled.push_back(Recipient { address: r.address.clone(), share_bps: new_bps });
            }
            Self::_distribute(&env, &token_client, &contract_addr, &scaled, distributable)?;
        }

        Ok(())
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    pub fn is_verified(env: &Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::VerifiedUsers(address))
            .unwrap_or(false)
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<Proposal> {
        env.storage().persistent().get(&DataKey::Proposal(proposal_id))
    }

    pub fn fee_bps(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::FeeBps).unwrap_or(0)
    }

    pub fn treasury(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Treasury).unwrap()
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn _require_admin(env: &Env) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotAdmin)?;
        admin.require_auth();
        Ok(())
    }

    fn _require_quorum_admin(env: &Env, caller: &Address) -> Result<(), Error> {
        let admins: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::QuorumAdmins)
            .ok_or(Error::NotAuthorizedAdmin)?;
        for a in admins.iter() {
            if a == *caller {
                return Ok(());
            }
        }
        Err(Error::NotAuthorizedAdmin)
    }

    fn _set_verified(env: &Env, user: &Address, status: bool) {
        env.storage()
            .persistent()
            .set(&DataKey::VerifiedUsers(user.clone()), &status);
    }

    fn _distribute(
        env: &Env,
        token_client: &token::Client,
        from: &Address,
        recipients: &Vec<Recipient>,
        distributable: i128,
    ) -> Result<(), Error> {
        for r in recipients.iter() {
            let amount = distributable
                .checked_mul(r.share_bps as i128)
                .ok_or(Error::Overflow)?
                / 10_000;
            if amount > 0 {
                token_client.transfer(from, &r.address, &amount);
            }
        }
        env.events().publish((symbol_short!("split"),), distributable);
        Ok(())
    }
}
