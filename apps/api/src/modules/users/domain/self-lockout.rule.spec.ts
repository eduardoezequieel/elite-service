import { locksOutSelf } from './self-lockout.rule';

const CRITICAL = 'roles.manage';

describe('locksOutSelf', () => {
  it('locks out a requester who would end up deactivated', () => {
    expect(locksOutSelf({ isActive: false, permissions: [CRITICAL] }, CRITICAL)).toBe(true);
  });

  it('locks out a requester who would end up without the critical permission', () => {
    expect(locksOutSelf({ isActive: true, permissions: ['users.read'] }, CRITICAL)).toBe(true);
  });

  it('locks out a requester who would end up with no permissions at all', () => {
    expect(locksOutSelf({ isActive: true, permissions: [] }, CRITICAL)).toBe(true);
  });

  it('lets through a requester who keeps the critical permission and stays active', () => {
    expect(locksOutSelf({ isActive: true, permissions: ['users.read', CRITICAL] }, CRITICAL)).toBe(
      false,
    );
  });
});
