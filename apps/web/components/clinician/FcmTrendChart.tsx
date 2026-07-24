import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * FCM (Functional Communication Measure) trend (SPEC §14, PRD §27). The scores are
 * SYNTHETIC and must be visibly labelled as such — synthetic clinical numbers must
 * never be mistaken for real measurement. Rendered as an inline SVG (no chart
 * dependency) with a role=img accessible summary and a visually-hidden data table.
 */

// Mock ASHA FCM scores (1–7 scale), one per week — clearly not real data.
const MOCK_FCM: { week: number; score: number }[] = [
  { week: 1, score: 3.0 },
  { week: 2, score: 3.2 },
  { week: 3, score: 3.5 },
  { week: 4, score: 3.4 },
  { week: 5, score: 3.8 },
  { week: 6, score: 4.0 },
  { week: 7, score: 4.2 },
  { week: 8, score: 4.5 },
];

const W = 600;
const H = 200;
const PAD = 32;
const MIN = 1;
const MAX = 7;

function x(i: number): number {
  return PAD + (i * (W - 2 * PAD)) / (MOCK_FCM.length - 1);
}
function y(score: number): number {
  return H - PAD - ((score - MIN) / (MAX - MIN)) * (H - 2 * PAD);
}

export function FcmTrendChart() {
  const line = MOCK_FCM.map((d, i) => `${x(i)},${y(d.score)}`).join(' ');
  const first = MOCK_FCM[0]!.score;
  const last = MOCK_FCM[MOCK_FCM.length - 1]!.score;
  const summary = `Mock FCM trend: ${first.toFixed(1)} to ${last.toFixed(1)} over ${MOCK_FCM.length} weeks (1–7 scale).`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">FCM Trend</CardTitle>
          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            MOCK DATA
          </span>
        </div>
        <CardDescription>
          Functional Communication Measure over time — synthetic sample, not a real clinical
          measurement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <svg
          role="img"
          aria-label={summary}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <line
            x1={PAD}
            y1={H - PAD}
            x2={W - PAD}
            y2={H - PAD}
            stroke="currentColor"
            opacity="0.2"
          />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="currentColor" opacity="0.2" />
          <polyline
            points={line}
            fill="none"
            stroke="#059669"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {MOCK_FCM.map((d, i) => (
            <circle key={d.week} cx={x(i)} cy={y(d.score)} r="3.5" fill="#059669" />
          ))}
        </svg>

        {/* Accessible data table alternative (visually hidden). */}
        <table className="sr-only">
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">FCM score (mock)</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_FCM.map((d) => (
              <tr key={d.week}>
                <td>{d.week}</td>
                <td>{d.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
