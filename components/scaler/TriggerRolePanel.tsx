'use client';

import { useState } from 'react';
import { Check, Copy, ShieldCheck } from 'lucide-react';

const ROLE_ARN_PATTERN = /^arn:aws:iam::\d{12}:role\/[\w+=,./@-]{1,64}$/;

// Illustrative stand-in for what a real deployment's GET /v1/aws/trigger-usage
// would return — this mock dashboard never calls the real events API (see
// README "Scaler definitions API" for the real, curl-testable endpoints this
// mirrors: GET /v1/aws/trigger-usage, PUT /v1/aws/role, POST /v1/aws/role/test).
const DEMO_QUEUE_ARN = 'arn:aws:sqs:us-east-1:123456789012:events';
const DEMO_USES_CLOUDWATCH = true;

function CopyableCommand({
  command,
  onCopied,
}: {
  command: string;
  onCopied: (message: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 overflow-hidden rounded-md border border-white/10 bg-[#14221c]">
      <div className="flex items-center justify-end border-b border-white/10 px-2.5 py-1.5">
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(command).catch(() => {});
            setCopied(true);
            onCopied('Command copied to clipboard');
            window.setTimeout(() => setCopied(false), 1200);
          }}
          className="flex items-center gap-1 text-[10px] font-semibold text-[#8ed3aa]"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}{' '}
          Copy
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-2.5 font-mono text-[10px] leading-5 text-[#d9e8df]">
        {command}
      </pre>
    </div>
  );
}

/**
 * The "Create a trigger-reader role" guide. Entirely client-side, like the
 * rest of this dashboard — it never calls the real events API. What it
 * generates (the CloudFormation deploy command, and the curl commands for
 * Test/Save) is exactly what a real deployment's GET /v1/aws/trigger-usage,
 * POST /v1/aws/role/test, and PUT /v1/aws/role do for real; run them there.
 */
export function TriggerRolePanel({
  onAction,
}: {
  onAction: (message: string) => void;
}) {
  const [namespace, setNamespace] = useState('production');
  const [serviceAccount, setServiceAccount] = useState('scaler');
  const [roleArn, setRoleArn] = useState('');
  const [savedArn, setSavedArn] = useState('');

  const roleArnLooksValid = ROLE_ARN_PATTERN.test(roleArn.trim());

  const deployCommand = [
    'aws cloudformation deploy \\',
    '  --template-file deploy/cloudformation/trigger-role.yaml \\',
    '  --stack-name scaler-trigger-reader \\',
    '  --capabilities CAPABILITY_NAMED_IAM \\',
    '  --parameter-overrides \\',
    '    ClusterOIDCProviderArn=<your-cluster-oidc-provider-arn> \\',
    '    OIDCProviderURL=<your-cluster-oidc-provider-url> \\',
    `    Namespace=${namespace || 'scaler'} \\`,
    `    ServiceAccountName=${serviceAccount || 'scaler'} \\`,
    `    QueueArns="${DEMO_QUEUE_ARN}" \\`,
    `    EnableCloudWatchRead=${DEMO_USES_CLOUDWATCH}`,
  ].join('\n');

  const testCommand = `curl -X POST http://localhost:3001/v1/aws/role/test \\
  -H "Authorization: Bearer $SCALER_EVENTS_TOKEN" -H "Content-Type: application/json" \\
  -d '{"roleArn":"${roleArn.trim() || '<role-arn>'}"}'`;

  const saveCommand = `curl -X PUT http://localhost:3001/v1/aws/role \\
  -H "Authorization: Bearer $SCALER_EVENTS_TOKEN" -H "Content-Type: application/json" \\
  -d '{"roleArn":"${roleArn.trim() || '<role-arn>'}"}'`;

  return (
    <div className="rounded-xl border border-[#dbe1dc] bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="size-4 text-[#2d7a57]" />
        <h3 className="text-sm font-semibold">Create a trigger-reader role</h3>
      </div>
      <p className="text-xs leading-5 text-[#718078]">
        A role trusted only by this service account, granted read access only to
        the AWS sources your triggers actually use. The queue/CloudWatch grants
        shown here are illustrative demo data — a real deployment builds this
        from its own enabled definitions.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] font-semibold text-[#5b6961]">
          Namespace
          <input
            value={namespace}
            onChange={(event) => setNamespace(event.target.value)}
            className="definition-input"
          />
        </label>
        <label className="block text-[11px] font-semibold text-[#5b6961]">
          Service account
          <input
            value={serviceAccount}
            onChange={(event) => setServiceAccount(event.target.value)}
            className="definition-input"
          />
        </label>
      </div>

      <div className="mt-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#89938d]">
          1. Create the role (CloudFormation) — if it doesn&apos;t already exist
        </div>
        <CopyableCommand command={deployCommand} onCopied={onAction} />
      </div>

      <div className="mt-4 border-t border-[#e4e8e4] pt-4">
        <label className="block text-[11px] font-semibold text-[#5b6961]">
          2. Role ARN
          <input
            value={roleArn}
            onChange={(event) => {
              setRoleArn(event.target.value);
            }}
            placeholder="arn:aws:iam::123456789012:role/scaler-trigger-reader"
            className="definition-input font-mono text-[11px]"
          />
        </label>
        {roleArn && !roleArnLooksValid ? (
          <p className="mt-1 text-[10px] text-[#a33f39]">
            Doesn&apos;t look like an IAM role ARN.
          </p>
        ) : null}
        {savedArn ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#59685f]">
            <span className="size-1.5 rounded-full bg-[#c9a227]" />
            Saved in this mock: <span className="font-mono">
              {savedArn}
            </span> ·
            not yet tested for real
          </p>
        ) : null}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#89938d]">
                3. Test
              </span>
              <button
                onClick={() => {
                  if (!roleArnLooksValid) return;
                  void navigator.clipboard?.writeText(testCommand).catch(() => {});
                  onAction(
                    'Test command copied — run it against your real events API',
                  );
                }}
                disabled={!roleArnLooksValid}
                className="rounded-md border border-[#d4dbd5] bg-white px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
              >
                Test
              </button>
            </div>
            <CopyableCommand command={testCommand} onCopied={onAction} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#89938d]">
                4. Save
              </span>
              <button
                onClick={() => {
                  if (!roleArnLooksValid) return;
                  setSavedArn(roleArn.trim());
                  void navigator.clipboard?.writeText(saveCommand).catch(() => {});
                  onAction(
                    'Saved locally in this mock — run the copied command to save it for real',
                  );
                }}
                disabled={!roleArnLooksValid}
                className="rounded-md bg-[#153e32] px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
              >
                Save
              </button>
            </div>
            <CopyableCommand command={saveCommand} onCopied={onAction} />
          </div>
        </div>
      </div>
    </div>
  );
}
