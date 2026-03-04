import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";

interface AttachmentResult {
  subject: string;
  receivedDate: string;
  filename: string;
  contentBytes: Buffer;
  size: number;
}

function getGraphClient(): Client {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET must be set");
  }

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.initWithMiddleware({ authProvider });
}

export async function fetchArgusReportAttachments(
  lookbackDays: number = 2
): Promise<AttachmentResult[]> {
  const client = getGraphClient();
  const userEmail = "emendoza@oiltex.com";

  // Search for recent emails from Argus with attachments
  const filterDate = new Date();
  filterDate.setDate(filterDate.getDate() - lookbackDays);
  const filterDateStr = filterDate.toISOString();

  const messages = await client
    .api(`/users/${userEmail}/messages`)
    .filter(
      `receivedDateTime ge ${filterDateStr} and hasAttachments eq true and from/emailAddress/address eq 'acr@argusalerts.com'`
    )
    .select("id,subject,receivedDateTime")
    .orderby("receivedDateTime desc")
    .top(10)
    .get();

  const results: AttachmentResult[] = [];

  for (const message of messages.value || []) {
    // Get attachments for this message
    const attachments = await client
      .api(`/users/${userEmail}/messages/${message.id}/attachments`)
      .get();

    for (const attachment of attachments.value || []) {
      // Only process PDF file attachments
      if (
        attachment["@odata.type"] === "#microsoft.graph.fileAttachment" &&
        attachment.contentType === "application/pdf"
      ) {
        results.push({
          subject: message.subject,
          receivedDate: message.receivedDateTime,
          filename: attachment.name,
          contentBytes: Buffer.from(attachment.contentBytes, "base64"),
          size: attachment.size,
        });
      }
    }
  }

  return results;
}
