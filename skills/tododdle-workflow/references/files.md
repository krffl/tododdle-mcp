# Files and Attachments

Read this file only when uploading or reviewing a ToDoddle file.

## Upload a Local File

- Use `upload_project_document` or `attach_file_to_ticket` for approved files.
- For a clipboard image, create a private directory with `mktemp -d` inside `<system-temp>/tododdle-mcp-uploads`. Copy the image into it and keep a suitable extension. Do not alter the original.
- If a source is outside managed staging or optional approved roots, copy it into the managed staging directory. Never move the original.
- After confirmed success, the local MCP deletes the staged file and its empty operation directory.
- If upload fails or is uncertain, keep the staged file for retry and report its path.
- Never delete the user’s original, a pre-existing file, or a file outside managed staging.

`TODODDLE_UPLOAD_ROOTS` is optional. Use it only for Docker, sandboxes, or approved permanent directories. Never approve the full system temporary directory.

## Upload Through Hosted MCP

1. Call `begin_upload` with a new idempotency key.
2. Upload bytes from the user’s device directly to the returned signed URL with its returned headers.
3. Call `complete_upload` with a new idempotency key.

Never print, log, or store the signed URL. The hosted gateway must not receive or stage file bytes. If the client cannot make the direct HTTPS upload, report that remote upload is unavailable. Do not put base64 file data in MCP arguments.

## Review an Attachment

1. Request a fresh URL with `get_document_download_url`.
2. Create a private temporary directory with `mktemp -d`.
3. Download without printing, logging, or storing the URL.
4. Inspect the local file with the appropriate image or document tool.
5. Use the browser only when local download or rendering is unavailable.
6. After successful inspection, delete only the temporary files and directory that the agent created.

Never store an expiring URL in comments, Context, logs, handoffs, or repository files. Never delete an original or pre-existing file.
