import { auth } from "@/auth";
import { getDocumentTypes, login } from "@/features/common/providers/5cap-api/5cap-api.provider";
import { endTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const result = await login();
  if(result.status !== 200) {
    return NextResponse.json({
      success: false,
      status: result.status,
      message: result.message,
    });
  }
  const sessionId = result.session_id!;
  const institutionId = process.env.DEC5_INSTITUTION!;
  const targetContentType = process.env.DEC5_TARGET_CONTENT_TYPE!;
  const documentTypes = await getDocumentTypes(institutionId, sessionId);
  const docType = documentTypes.result.document_types.filter(dt => dt.name == targetContentType )[0];
  console.log(documentTypes);

  
  return NextResponse.json({
    success: true,
    // status: 200,
    ...result,
  });
}
