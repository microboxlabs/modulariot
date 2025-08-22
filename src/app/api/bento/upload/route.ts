import "server-only";
import { auth } from "@/auth";
import { uploadNodeContent } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import {
  UploadNodeRequest,
  UploadNodeResponse,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
import type { Session } from "next-auth";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse the multipart form data
    const formData = await request.formData();

    // Extract form fields
    const file = formData.get("filedata") as File;
    const contentType = formData.get("prop_mintral_contentType") as string;
    const fileName = formData.get("prop_cm_name") as string;
    const mimeType = formData.get("prop_mimetype") as string;
    const destination = formData.get("alf_destination") as string;

    if (!file || !contentType || !fileName || !mimeType || !destination) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    let alfrescoResponse: UploadNodeResponse;
    let currentFileName = fileName;

    alfrescoResponse = await uploadFile(
      file,
      contentType,
      destination,
      currentFileName,
      session
    );

    if (!alfrescoResponse) {
      return NextResponse.json(
        { error: "Upload failed - no response from server" },
        { status: 500 }
      );
    }

    if (
      alfrescoResponse.status.code < 200 ||
      alfrescoResponse.status.code >= 300
    ) {
      return NextResponse.json(
        { error: "Upload failed", status: alfrescoResponse.status },
        {
          status: alfrescoResponse.status.code,
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      data: alfrescoResponse,
      filename: currentFileName, // Return the actual filename used
    });
  } catch (error: any) {
    logError(error as Error);
    return NextResponse.json(
      {
        error: error.message || "Upload failed",
        details: error.info || null,
      },
      { status: 500 }
    );
  }
}

async function uploadFile(
  file: File,
  contentType: string,
  destination: string,
  fileName: string,
  session: Session
) {
  const formData: UploadNodeRequest = {
    filedata: file,
    prop_mintral_contentType: contentType,
    filename: fileName,
    destination,
    contentType: "mintral:content",
    thumbnails: ["doclib"],
  };

  return await uploadNodeContent(session, formData);
}
