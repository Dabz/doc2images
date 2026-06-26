import { Const } from "./const";
import { clearOAuthCookieHeaders, encodeR2ObjectKey } from "./cookies";
import { getToken } from "./oauth";

export async function uploadToR2(
  request: Request<unknown, CfProperties<unknown>>,
) {
  const accessToken = getToken(request);
  if (!accessToken) {
    return Response.json({ loginUrl: "/login" }, { status: 401 });
  }

  const formData = await request.formData();
  const filename = formData.get("filename");
  if (typeof filename !== "string" || filename.length === 0) {
    return Response.json("Missing filename", { status: 400 });
  }

  const accountId = await getOrCreateR2Bucket(request);
  for (const [key, value] of formData.entries()) {
    if (key === "filename") continue;
    if (typeof value === "string") continue;
    const file = value as File;
    const uploadResponse = await fetch(
      `${Const.CLOUDFLARE_API_URL}/accounts/${accountId}/r2/buckets/${Const.R2_BUCKET_NAME}/objects/${encodeR2ObjectKey(`${filename}/${key}`)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: await file.arrayBuffer(),
      },
    );

    if (!uploadResponse.ok) {
      if (uploadResponse.status === 401 || uploadResponse.status === 403) {
        return Response.json(
          { loginUrl: "/login", error: await uploadResponse.text() },
          { status: 401, headers: clearOAuthCookieHeaders() },
        );
      }
      throw new Error(
        `R2 upload failed with status ${uploadResponse.status}: ${await uploadResponse.text()}`,
      );
    }
  }
  return Response.json({
    status: "success",
  });
}

export async function getOrCreateR2Bucket(request: Request) {
  const accessToken = getToken(request);

  const accountsResponse = await fetch(`${Const.CLOUDFLARE_API_URL}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!accountsResponse.ok) {
    throw new Error(
      `Unable to list Cloudflare accounts: ${await accountsResponse.text()}`,
    );
  }

  const accounts = await accountsResponse.json<{
    result?: Array<{ id: string }>;
  }>();
  let accountIdForBucketCreate: string | undefined;

  for (const account of accounts.result ?? []) {
    const bucketsResponse = await fetch(
      `${Const.CLOUDFLARE_API_URL}/accounts/${account.id}/r2/buckets?name_contains=${Const.R2_BUCKET_NAME}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!bucketsResponse.ok) continue;

    accountIdForBucketCreate ??= account.id;

    const buckets = await bucketsResponse.json<{
      result?: { buckets?: Array<{ name?: string }> };
    }>();
    if (
      buckets.result?.buckets?.some(
        (bucket) => bucket.name === Const.R2_BUCKET_NAME,
      )
    ) {
      return account.id;
    }
  }

  if (accountIdForBucketCreate) {
    const createBucketResponse = await fetch(
      `${Const.CLOUDFLARE_API_URL}/accounts/${accountIdForBucketCreate}/r2/buckets/${Const.R2_BUCKET_NAME}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );

    if (createBucketResponse.ok || createBucketResponse.status === 409) {
      return accountIdForBucketCreate;
    }

    throw new Error(
      `Unable to create R2 bucket ${Const.R2_BUCKET_NAME}: ${await createBucketResponse.text()}`,
    );
  }

  throw new Error(
    `Could not find or create R2 bucket ${Const.R2_BUCKET_NAME} in authorized Cloudflare accounts`,
  );
}
