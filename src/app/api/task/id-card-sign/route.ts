import { auth } from "@/auth";
import {
  // getDocumentTypes,
  login,
  // createContentSign,
  createContent,
  signIdCard,
  getDocument,
} from "@/features/common/providers/5cap-api/5cap-api.provider";
import {
  ContentRequest,
  GetDocumentRequest,
  SignIdCardRequest,
} from "@/features/common/providers/5cap-api/5cap-api.provider.types";
import {
  //endTask,
  getContentByTaskId,
  uploadNodeContent,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { tryCatch } from "@/utils/tryCatch";

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
    const receiverRole = process.env.DEC5_RECEIVER_ROLE!;
    // const signerRoles = process.env.DEC5_SIGNER_ROLES!;

    const json = (await request.json()) as {
      serviceCode: string;
      signersEmails: string[];
      signerRuts: string;
      nro_serie: string;
      taskId: string;
      auditNumbers: string[];
      bpmPackage: string;
      taskType: string;
      transitionId: string;
    };

    let documentName = "ho-sin-firma.pdf";
    let uploadFileName = "ho-firmado.pdf";
    let targetRole = dispatcherRole;
    let requireInternalSign = true;
    if (json.taskType === "confirmDelivery") {
      documentName = "ho-firmado.pdf";
      uploadFileName = "ho-recepcionado.pdf";
      targetRole = receiverRole;
      requireInternalSign = false;
    }
    const file = await getContentByTaskId(
      session.user.ticket,
      `activiti$${json.taskId}`,
      documentName,
      requireInternalSign,
    );

    let signersRoles: string[] = [];
    let signersInstitutions: string[] = [];
    let signersEmails: string[] = [];
    let signersRuts: string[] = [];
    let signersType: number[] = [];
    let signersOrder: number[] = [];
    let signersNotify: number[] = [];
    let signersAudit: string[] = [];

    signersRoles.push(json.signerRuts);
    signersInstitutions.push(json.signerRuts);
    signersEmails.push("michel@microboxlabs.com");
    signersRuts.push(json.signerRuts);
    signersType.push(0);
    signersOrder.push(1);
    signersNotify.push(2);
    signersAudit.push(json.auditNumbers[0]);

    // last signer is the dispatcher
    if (json.taskType === "confirmDelivery") {
      signersRoles[signersRoles.length - 1] = targetRole;
      signersNotify[signersNotify.length - 1] = 1;
      signersInstitutions[signersInstitutions.length - 1] = institutionId;
    }

    signersRoles.push("Admin");
    signersInstitutions.push(institutionId);
    signersEmails.push("any");
    signersRuts.push("any");
    signersType.push(5);
    signersOrder.push(json.signerRuts.length + 1);
    signersNotify.push(0);
    signersAudit.push("");

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

    const response = await createContent(createContentRequest);
    if (response.status !== 200) {
      return NextResponse.json({
        success: false,
        status: response.status,
        message: response.message,
      });
    }

    console.log(JSON.stringify(response));
    const documentCode = response.result.code!;
    const signIdCardRequest: SignIdCardRequest = {
      user_rut: json.signerRuts,
      nro_serie: json.nro_serie,
      user_role: json.signerRuts,
      user_institution: institutionId,
      code: documentCode,
      session_id: sessionId,
    };

    console.log(JSON.stringify(signIdCardRequest));
    const signIdCardResponse = await signIdCard(signIdCardRequest);
    if (signIdCardResponse.status !== 200) {
      return NextResponse.json({
        success: false,
        status: signIdCardResponse.status,
        message: signIdCardResponse.message,
      });
    }

    const getDocumentRequest: GetDocumentRequest = {
      code: documentCode,
      institution: institutionId,
      extra: "file",
      session_id: sessionId,
    };

    const getDocumentResponse = await getDocument(getDocumentRequest);
    if (getDocumentResponse.status !== 200) {
      return NextResponse.json({
        success: false,
        status: getDocumentResponse.status,
        message: getDocumentResponse.message,
      });
    }

    /* const response = await createContentSign(createContentRequest);
    //console.log({ ...response.result, file: "<...binary data...>" });
    if (response.status !== 200) {
      return NextResponse.json({
        success: false,
        status: response.status,
        message: response.message,
      });
    } */
    const signedFileResponse = getDocumentResponse.result.file!;
    // Convert base64 to Uint8Array
    const binaryString = atob(signedFileResponse);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create a Blob from the Uint8Array
    const blob = new Blob([bytes], { type: "application/pdf" });

    // Create a File object from the Blob
    const signedFile = new File([blob], uploadFileName, {
      type: "application/pdf",
    });

    // save file to file system
    const filePath = `./public/storage/${uploadFileName}`;
    const fileBuffer = await signedFile.arrayBuffer();
    const fileBufferUint8Array = new Uint8Array(fileBuffer);
    //save file as a promise
    const saveFileResult = await tryCatch(
      new Promise((resolve, reject) => {
        fs.writeFile(filePath, fileBufferUint8Array, (err) => {
          if (err) reject(err);
          resolve(true);
        });
      }),
    );

    const uploadResponse = await uploadNodeContent(session.user.ticket, {
      filename: uploadFileName,
      filedata: signedFile,
      destination: json.bpmPackage,
    });

    if (uploadResponse !== null && saveFileResult.data) {
      //remove file from file system in a promise
      await new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
          if (err) reject(err);
          resolve(true);
        });
      });
    }

    /* const endTaskResult = await endTask(
      session.user.ticket,
      json.taskId,
      json.transitionId,
    );

    console.log(endTaskResult); */

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
