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
    aspectNames?: string[];
    properties: Record<string, string | undefined>;
    // Aspect QNames applied to the node (requested via include=aspectNames in the
    // /app/api/bento/multimedia route). Used to tell reviewable from non-reviewable
    // content — see isReviewableEntry in ./reviewable.
    aspectNames?: string[];
  };
}

export interface ImageItem {
  file: AlfrescoFileEntry;
}
