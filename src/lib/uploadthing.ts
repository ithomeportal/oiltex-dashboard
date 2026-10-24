import { createUploadthing, type FileRouter } from "uploadthing/server";
import { UploadThingError } from "uploadthing/server";
import { SESSION_COOKIE, sessionFromToken, type Session } from "@/lib/session";
import { recordPendingUpload } from "@/lib/sener/files";

const f = createUploadthing();

function cookieValue(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return undefined; // malformed cookie → treated as no session (401, not 500)
  }
}

async function requireSession(req: Request): Promise<Session> {
  const session = await sessionFromToken(cookieValue(req, SESSION_COOKIE));
  if (!session) throw new UploadThingError("Unauthorized");
  return session;
}

export const ourFileRouter = {
  pdfUploader: f({
    pdf: {
      maxFileSize: "8MB",
      maxFileCount: 10,
    },
  })
    .middleware(async ({ req }) => {
      const session = await requireSession(req);
      if (session.scope !== "internal") throw new UploadThingError("Forbidden");
      return { uploadedBy: session.email };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedBy: metadata.uploadedBy,
        name: file.name,
        url: file.ufsUrl,
        key: file.key,
        size: file.size,
      };
    }),

  // SENER LOI originals. Upload goes browser → UploadThing directly (Vercel caps
  // route bodies at 4.5 MB); the client then registers the key with
  // POST /api/sener/files/[hash], which re-reads the bytes and verifies the hash.
  senerUploader: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "16MB", maxFileCount: 1 },
    text: { maxFileSize: "4MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const session = await requireSession(req);
      return { uploadedBy: session.email };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await recordPendingUpload(file.key, metadata.uploadedBy);
      return { uploadedBy: metadata.uploadedBy, key: file.key, name: file.name, size: file.size };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
