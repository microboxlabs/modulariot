import { auth } from "@/auth";
import {
  // getDocumentTypes,
  login,
} from "@/features/common/providers/5cap-api/5cap-api.provider";
// import { ContentRequest } from "@/features/common/providers/5cap-api/5cap-api.provider.types";
// import { endTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const result = await login();
  if (result.status !== 200) {
    return NextResponse.json({
      success: false,
      status: result.status,
      message: result.message,
    });
  }
  // const sessionId = result.session_id!;
  // const institutionId = process.env.DEC5_INSTITUTION!;
  // const targetContentType = process.env.DEC5_TARGET_CONTENT_TYPE!;
  // const signerRoles = process.env.DEC5_SIGNER_ROLES!;
  // const json = await request.json();

  // const documentTypes = await getDocumentTypes(institutionId, sessionId);
  // const docType = documentTypes.result.document_types.filter(dt => dt.name == targetContentType )[0];
  // console.log(documentTypes);

  // const createContentRequest: ContentRequest = {
  //   type_code: targetContentType,
  //   institution: institutionId,
  //   name: json.serviceCode,
  //   session_id: sessionId,
  //   signers_roles: json.signersRoles.split(),

  // };

  // {
  //   type_code,
  //   institution: INSTITUTION,
  //   name,
  //   session_id,
  //   signers_roles: SIGNER_ROLES.split(),
  //   signers_institutions: [ INSTITUTION ],
  //   signers_emails: signRequest.getSignerEmails(),
  //   signers_ruts: signRequest.getRuts(),
  //   signers_type: signRequest.getSignersType(),
  //   signers_order: signRequest.getSignersOrder(),
  //   signers_notify: signRequest.getSignerNotifications(),
  //   signers_audit: signRequest.getSignerAudit(),
  //   file: base64,
  //   file_mime: file.mime,
  //   return_file: 1//signRequest.getReturnFileId()
  // }

  return NextResponse.json({
    success: true,
    // status: 200,
    ...result,
  });
}
