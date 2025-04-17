import { auth } from "@/auth";
import { getTaskHistory } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest } from "next/server";

describe("Task History", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return error when no taskId is provided", async () => {

    /*
    const mockRequest = new NextRequest(
      new URL("http://localhost:3000/api/task/history")
    );
    */
    console.log("example");
  });
});
