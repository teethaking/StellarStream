/// All contract errors for the V3 splitter.
#[soroban_sdk::contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotAdmin = 2,
    RecipientNotVerified = 3,
    NoVerifiedRecipients = 4,
    InvalidSplit = 5,
    Overflow = 6,
    NotAuthorizedAdmin = 7,   // caller is not in the 3-admin list
    AlreadyApproved = 8,      // caller already voted on this proposal
    ProposalNotFound = 9,
    AlreadyExecuted = 10,
    QuorumNotReached = 11,    // < 2 approvals
}
