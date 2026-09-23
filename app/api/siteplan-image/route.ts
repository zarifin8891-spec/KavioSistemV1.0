import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new NextResponse('Siteplan id is required', { status: 400 });
  }

  const { data: siteplan, error: siteplanError } = await supabase
    .from('siteplan_versions')
    .select('file_path,mime_type,file_name')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (siteplanError) {
    return new NextResponse(siteplanError.message, { status: 500 });
  }

  if (!siteplan?.file_path) {
    return new NextResponse('Active Siteplan not found', { status: 404 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from('siteplans')
    .createSignedUrl(siteplan.file_path, 300);

  if (signedError || !signed?.signedUrl) {
    return new NextResponse(signedError?.message || 'Signed URL could not be created', { status: 500 });
  }

  const upstream = await fetch(signed.signedUrl, {
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return new NextResponse('Siteplan file could not be fetched', { status: upstream.status });
  }

  const contentType = siteplan.mime_type || upstream.headers.get('content-type') || 'application/octet-stream';
  const body = await upstream.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
