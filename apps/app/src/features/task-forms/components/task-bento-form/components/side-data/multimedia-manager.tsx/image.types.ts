export interface AlfrescoFileEntry {
  entry: {
    id: string;
    name: string;
    content: {
      mimeType: string;
      mimeTypeName: string;
      sizeInBytes: number;
      encoding: string;
    };
    createdAt: string;
    createdByUser: {
      id: string;
      displayName: string;
    };
    isFile: boolean;
    isFolder: boolean;
    modifiedAt: string;
    modifiedByUser: {
      id: string;
      displayName: string;
    };
    nodeType: string;
    parentId: string;
  };
}
