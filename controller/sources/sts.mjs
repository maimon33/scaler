// Reads the events API's own live AWS identity — used to verify a candidate
// trigger-reader role ARN actually works, without needing a separate
// AssumeRole call or a projected web-identity token: if IRSA is wired up
// correctly, the server's default credential chain already *is* the
// configured role, so GetCallerIdentity is enough to prove it.
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';

let cachedClient;
function client() {
  if (!cachedClient) cachedClient = new STSClient({});
  return cachedClient;
}

/** For tests: replace or reset the singleton STS client. */
export function __setStsClientForTesting(mock) {
  cachedClient = mock;
}

export async function readCallerIdentity() {
  const response = await client().send(new GetCallerIdentityCommand({}));
  return {
    arn: response.Arn,
    account: response.Account,
    userId: response.UserId,
  };
}
