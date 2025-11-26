// import { auth } from "@/auth";
import {
  login,
  createContent,
  signIdCard,
} from "@/features/common/providers/5cap-api/5cap-api.provider";
import {
  ContentRequest,
  SignIdCardRequest,
} from "@/features/common/providers/5cap-api/5cap-api.provider.types";

import { NextRequest, NextResponse } from "next/server";
import { readPDFAsBase64 } from "@/utils/pdf-utils";

export async function POST(request: NextRequest) {
  /* const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  } */
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

    const json = (await request.json()) as {
      user_rut: string;
      nro_serie: string;
    };

    let signersRoles: string[] = [];
    let signersInstitutions: string[] = [];
    let signersEmails: string[] = [];
    let signersRuts: string[] = [];
    let signersType: number[] = [];
    let signersOrder: number[] = [];
    let signersNotify: number[] = [];
    let signersAudit: string[] = [];

    signersRoles.push(json.user_rut);
    signersInstitutions.push(json.user_rut);
    signersEmails.push("michel@microboxlabs.com");
    signersRuts.push(json.user_rut);
    signersType.push(0);
    signersOrder.push(1);
    signersNotify.push(2);
    signersRoles.push("Admin");
    signersInstitutions.push(institutionId);
    signersEmails.push("any");
    signersRuts.push("any");
    signersType.push(5);
    signersOrder.push(1);
    signersNotify.push(0);
    signersAudit.push("");
    const fileContent = await readPDFAsBase64("servicios-mineros.pdf");
    const createContentRequest: ContentRequest = {
      type_code: targetContentType,
      institution: institutionId,
      name: "Servicios Mineros",
      session_id: sessionId,
      signers_roles: signersRoles,
      signers_institutions: signersInstitutions,
      signers_emails: signersEmails,
      signers_ruts: signersRuts,
      signers_type: signersType,
      signers_order: signersOrder,
      signers_notify: signersNotify,
      signers_audit: signersAudit,
      file: fileContent,
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

    const documentCode = response.result.code!;
    const signIdCardRequest: SignIdCardRequest = {
      user_rut: json.user_rut,
      nro_serie: json.nro_serie,
      user_role: json.user_rut,
      user_institution: institutionId,
      code: documentCode,
      session_id: sessionId,
    };

    const signIdCardResponse = await signIdCard(signIdCardRequest);
    if (signIdCardResponse.status !== 200) {
      return NextResponse.json({
        success: false,
        status: signIdCardResponse.status,
        message: signIdCardResponse.message,
      });
    }

    if (signIdCardResponse.status !== 200) {
      return NextResponse.json({
        success: false,
        status: signIdCardResponse.status,
        message: "Error al firmar el contenido",
      });
    }

    return NextResponse.json({
      success: true,
      // status: 200,
      response,
    });
  } catch (error: any) {    
    return NextResponse.json({
      success: false,
      status: error.status,
      message: error.info ? JSON.parse(error.info).message as string : error.message,
    });
  }
}
