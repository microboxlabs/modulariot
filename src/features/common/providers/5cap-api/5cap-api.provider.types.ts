// error result
// {
//   "status": 400,
//   "message": "Usuario o clave inválidos",
//   "session_id": null,
//   "result": []
// }

// success result
// {
//   "status": 200,
//   "message": "Success",
//   "session_id": "pdzbvyr00bc0f0b8910d4e99bac5e627a78d94ee",
//   "result": {
//       "user_rut": "10-8",
//       "user_name": "",
//       "audit": "",
//       "institutions": []
//   }
// }
export type LoginResult = {
  status: number;
  message: string;
  session_id: string | null;
  result?: {
    user_rut: string;
    user_name: string;
    audit: string;
    institutions: any[];
  };
};

export type DocumentTypesResult = {
  status: number;
  message: string;
  result: {
    count: number;
    page: number;
    total: number;
    document_types: {
      id: string;
      creator: string[];
      description: string;
      enable: number;
      fields: any[];
      institution: string;
      name: string;
      tags: any[];
      template: number;
      type_code: string;
    }[];
  };
};

// CreateContentRequest
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

export type ContentRequest = {
  type_code: string;
  institution: string;
  name: string;
  session_id: string;
  signers_roles: string[];
  signers_institutions: string[];
  signers_emails: string[];
  signers_ruts: string[];
  signers_type: number[];
  signers_order: number[];
  signers_notify: number[];
  signers_audit: string[];
  file: string;
  file_mime: string;
  return_file: number;
};

export type ContentResult = {
  status: number;
  message: string;
  result: {
    code: string;
    file?: string;
  };
};
