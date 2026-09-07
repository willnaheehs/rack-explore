'use client';
import { Check, AlertTriangle, CircleHelp } from 'lucide-react';
import type { ConfigReport } from '@/lib/config-validation';

export default function ConfigurationChecks({
  report,
}: {
  report: ConfigReport;
}) {
  const errors = report.issues.filter((i) => i.level === 'error');
  const reviews = report.issues.filter((i) => i.level === 'review');
  return (
    <details
      className="configuration-checks"
      open={errors.length ? true : undefined}
    >
      <summary>
        {errors.length ? <AlertTriangle size={17} /> : <Check size={17} />}
        <span>
          <strong>Configuration checks</strong>
          <small>
            {errors.length
              ? `${errors.length} problems to fix`
              : 'Layout checks pass'}{' '}
            · {reviews.length} items to confirm
          </small>
        </span>
      </summary>
      <div className="configuration-check-body">
        <p>
          Checks apply to the modeled configuration. Manufacturer references
          describe hardware capabilities; this is not a production inventory or
          deployment certification.
        </p>
        {report.checks.map((check) => (
          <div
            className={`configuration-check-row ${check.status}`}
            key={check.area}
          >
            {check.status === 'error' ? (
              <AlertTriangle size={15} />
            ) : check.status === 'review' ? (
              <CircleHelp size={15} />
            ) : (
              <Check size={15} />
            )}
            <div>
              <strong>{check.area}</strong>
              <p>{check.detail}</p>
            </div>
          </div>
        ))}
        {report.issues.length > 0 && (
          <>
            <h4>Remaining details</h4>
            <ul>
              {report.issues.map((issue, i) => (
                <li key={`${issue.area}-${i}`} className={issue.level}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  );
}
