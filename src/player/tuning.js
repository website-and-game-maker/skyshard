// Every movement number in one place so feel can be tuned without touching logic.
export const TUNING = {
  halfWidth: 0.35,
  height: 1.1,
  stepHeight: 0.32,

  runSpeed: 7.5,
  groundAccel: 70,
  groundDecel: 55,
  airAccel: 30,
  airDecel: 6,
  turnSpeed: 14,
  backpedalMult: 0.6, // tank scheme: backing up is slower // radians/s the model turns toward travel direction

  gravity: 34,
  fallGravityMult: 1.55,
  maxFallSpeed: 32,
  jumpSpeed: 12.6,
  doubleJumpSpeed: 11.2,
  jumpCutMult: 0.5, // vertical speed kept when jump is released early
  coyoteTime: 0.11,
  jumpBuffer: 0.13,

  dashSpeed: 19,
  dashTime: 0.17,
  dashCooldown: 0.38,
  dashEndSpeed: 9, // horizontal speed left after the dash ends

  poundHang: 0.16, // brief freeze before slamming down
  poundSpeed: 30,
  poundRecover: 0.22,
  poundBounce: 7, // little hop after landing a pound

  stompBounce: 9,
  hurtInvuln: 1.5,
  springSpeed: 24,
  hurtStun: 0.35,

  maxSubstep: 0.22, // max distance moved per collision step
};
