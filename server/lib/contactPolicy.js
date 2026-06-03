export const CONTACT_REQUEST_POLICIES = ["nobody", "acquaintances", "everyone"];

export function normalizeContactRequestPolicy(value) {
  const policy = String(value || "").toLowerCase();
  return CONTACT_REQUEST_POLICIES.includes(policy) ? policy : "everyone";
}

export function evaluateContactRequestAccess({
  fromUser,
  toUser,
  usersShareGroup,
  blockedEitherWay,
}) {
  if (blockedEitherWay) {
    return {
      allowed: false,
      code: "blocked",
      message: "Contact request is not allowed.",
    };
  }

  const policy = normalizeContactRequestPolicy(toUser?.contact_request_policy);

  if (policy === "nobody") {
    return {
      allowed: false,
      code: "contact_requests_closed",
      message: "This user is not accepting contact requests.",
    };
  }

  if (policy === "everyone") {
    return { allowed: true };
  }

  if (usersShareGroup) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: "contact_not_acquaintance",
    message: "You must share a group with this user to send a contact request.",
  };
}
