export const DEMO_USER = {
  user_id: "u-corp-001",
  email: "demo@demo.com",
  username: "Demo User",
  org_id: "org-demo-001",
  plant_id: null as string | null,
  role: "corp_head",
  password: "demo123",
} as const;

export function tokenForExp(exp: number) {
  return `demo-token-${DEMO_USER.user_id}-${exp}`;
}

export function expIn(seconds: number) {
  return Math.floor(Date.now() / 1000) + seconds;
}

export function buildPayload(exp: number) {
  return {
    user_id: DEMO_USER.user_id,
    email: DEMO_USER.email,
    username: DEMO_USER.username,
    org_id: DEMO_USER.org_id,
    plant_id: DEMO_USER.plant_id,
    role: DEMO_USER.role,
    exp,
  };
}
