import { auth } from "@/auth";
import {
  // getDocumentTypes,
  login,
  createContentSign,
} from "@/features/common/providers/5cap-api/5cap-api.provider";
import { ContentRequest } from "@/features/common/providers/5cap-api/5cap-api.provider.types";
import {
  endTask,
  getContentByTaskId,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
// import { endTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  try {
    const result = await login();
    if (result.status !== 200) {
      return NextResponse.json({
        success: false,
        status: result.status,
        message: result.message,
      });
    }
    const sessionId = result.session_id!;
    const institutionId = process.env.DEC5_INSTITUTION!;
    const targetContentType = process.env.DEC5_TARGET_CONTENT_TYPE!;
    // const signerRoles = process.env.DEC5_SIGNER_ROLES!;

    const json = (await request.json()) as {
      serviceCode: string;
      signersEmails: string[];
      signerRuts: string[];
      taskId: string;
      auditNumbers: string[];
    };

    const file = await getContentByTaskId(
      session.user.ticket,
      json.taskId,
      "ho-sin-firma.pdf",
    );

    // const documentTypes = await getDocumentTypes(institutionId, sessionId);
    // const docType = documentTypes.result.document_types.filter(dt => dt.name == targetContentType )[0];
    // console.log(documentTypes);

    const createContentRequest: ContentRequest = {
      type_code: targetContentType,
      institution: institutionId,
      name: json.serviceCode,
      session_id: sessionId,
      signers_roles: json.signerRuts,
      signers_institutions: json.signerRuts,
      signers_emails: json.signersEmails,
      signers_ruts: json.signerRuts,
      signers_type: json.signersEmails.map((_) => 0),
      signers_order: json.signersEmails.map((_, _index) => 1),
      signers_notify: json.signersEmails.map((_) => 0),
      signers_audit: json.auditNumbers,
      file,
      file_mime: "application/pdf",
      return_file: 1,
    };
    // console.log("createContentRequest", createContentRequest);
    const response = await createContentSign(createContentRequest);
    if (response.status !== 200) {
      return NextResponse.json({
        success: false,
        status: response.status,
        message: response.message,
      });
    }
    const _signedFile = response.result.file;
    const endTaskResult = await endTask(session.user.ticket, json.taskId);

    console.log(endTaskResult);

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
      response,
    });
  } catch (error: any) {
    console.error(JSON.stringify(error));
    return NextResponse.json({
      success: false,
      status: 500,
      message: error.message,
    });
  }
}
