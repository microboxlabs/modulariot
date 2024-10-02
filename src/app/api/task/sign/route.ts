import { auth } from "@/auth";
import {
  // getDocumentTypes,
  login,
  createContentSign,
} from "@/features/common/providers/5cap-api/5cap-api.provider";
import { ContentRequest } from "@/features/common/providers/5cap-api/5cap-api.provider.types";
import {
  // endTask,
  getContentByTaskId,
  uploadNodeContent,
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
    const dispatcherRole = process.env.DEC5_DISPATCHER_ROLE!;
    // const signerRoles = process.env.DEC5_SIGNER_ROLES!;

    const json = (await request.json()) as {
      serviceCode: string;
      signersEmails: string[];
      signerRuts: string[];
      taskId: string;
      auditNumbers: string[];
      bpmPackage: string;
    };

    const file = await getContentByTaskId(
      session.user.ticket,
      json.taskId,
      "ho-sin-firma.pdf",
    );

    // const documentTypes = await getDocumentTypes(institutionId, sessionId);
    // const docType = documentTypes.result.document_types.filter(dt => dt.name == targetContentType )[0];
    // console.log(documentTypes);

    let signersRoles: string[] = [];
    let signersInstitutions: string[] = [];
    let signersEmails: string[] = [];
    let signersRuts: string[] = [];
    let signersType: number[] = [];
    let signersOrder: number[] = [];
    let signersNotify: number[] = [];
    let signersAudit: string[] = [];

    json.signerRuts.forEach((rut, index) => {
      signersRoles.push(rut);
      signersInstitutions.push(rut);
      signersEmails.push("michel@microboxlabs.com");
      signersRuts.push(rut);
      signersType.push(0);
      signersOrder.push(index + 1);
      signersNotify.push(2);
      signersAudit.push(json.auditNumbers[index]);
    });

    // last signer is the dispatcher
    signersRoles[signersRoles.length - 1] = dispatcherRole;

    // signersRoles.push("Admin");
    // signersInstitutions.push(institutionId);
    // signersEmails.push("any");
    // signersRuts.push("any");
    // signersType.push(5);
    // signersOrder.push(json.signerRuts.length + 1);
    // signersNotify.push(0);
    // signersAudit.push("");

    const createContentRequest: ContentRequest = {
      type_code: targetContentType,
      institution: institutionId,
      name: json.serviceCode,
      session_id: sessionId,
      signers_roles: signersRoles,
      signers_institutions: signersInstitutions,
      signers_emails: signersEmails,
      signers_ruts: signersRuts,
      signers_type: signersType,
      signers_order: signersOrder,
      signers_notify: signersNotify,
      signers_audit: signersAudit,
      file,
      file_mime: "application/pdf",
      return_file: 1,
    };
    console.log("createContentRequest", {
      ...createContentRequest,
      file: "<...binary data...>",
    });
    const response = await createContentSign(createContentRequest);
    console.log({ ...response.result, file: "<...binary data...>" });
    if (response.status !== 200) {
      return NextResponse.json({
        success: false,
        status: response.status,
        message: response.message,
      });
    }
    const _signedFile = response.result.file!;
    // Convert base64 to Uint8Array
    const binaryString = atob(_signedFile);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create a Blob from the Uint8Array
    const blob = new Blob([bytes], { type: "application/pdf" });

    // Create a File object from the Blob
    const signedFile = new File([blob], `ho-firmado.pdf`, {
      type: "application/pdf",
    });
    console.log("uploadNodeContent", {
      filename: "ho-firmado.pdf",
      destination: json.bpmPackage,
    });
    const uploadResposne = await uploadNodeContent(session.user.ticket, {
      filename: "ho-firmado.pdf",
      filedata: signedFile,
      destination: json.bpmPackage,
    });

    console.log(uploadResposne);

    // const endTaskResult = await endTask(session.user.ticket, json.taskId);

    // console.log(endTaskResult);

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
