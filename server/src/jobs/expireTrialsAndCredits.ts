import { AdminBillingService } from '../services/adminBillingService';
import { CreditService } from '../services/creditService';
import { NotificationService } from '../services/notificationService';

/**
 * Daily job that reverts expired trials and claws back expired credit grants.
 *
 * Both halves are idempotent: an expired trial has its status and trial_ends_at
 * cleared, and an expired grant gets an offsetting ledger row linked back to it,
 * so a second run in the same day finds nothing left to do.
 */
export async function expireTrialsAndCredits(): Promise<{
  trialsExpired: number;
  grantsExpired: number;
  creditsExpired: number;
}> {
  const trials = await AdminBillingService.expireTrials();

  // Tell each affected user their trial ended, so the drop in limits is not a
  // silent surprise. A notification failure must not abort the job.
  for (const userId of trials.userIds) {
    try {
      await NotificationService.create(
        userId,
        'trial_expired',
        'Your trial has ended. Your account has returned to the Free plan — upgrade any time to restore your limits.',
        '/pricing'
      );
    } catch (error: unknown) {
      console.error(
        'Trial expiry notification failed:',
        error instanceof Error ? error.message : error
      );
    }
  }

  const credits = await CreditService.expireCredits();

  return {
    trialsExpired: trials.expired,
    grantsExpired: credits.grantsExpired,
    creditsExpired: credits.creditsExpired,
  };
}

export default expireTrialsAndCredits;
