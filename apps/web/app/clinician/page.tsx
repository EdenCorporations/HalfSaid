import { FcmTrendChart } from '@/components/clinician/FcmTrendChart';
import { ConversationLog } from '@/components/clinician/ConversationLog';

/**
 * Simple clinician dashboard (SPEC §14). FCM trend (visibly MOCK) + conversation log.
 */
export default function ClinicianPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Clinician Dashboard</h1>
        <p className="text-sm text-muted-foreground">FCM trend and conversation log for Maya.</p>
      </header>
      <FcmTrendChart />
      <ConversationLog />
    </div>
  );
}
