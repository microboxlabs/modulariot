export interface AlfrescoFileEntry {
  entry: {
    id: string;
    name: string;
    // Alfresco omits `content` entirely for nodes that have no content stream
    // (e.g. folder nodes, or entries returned before an upload finishes), so this
    // is optional — every read must guard with `?.` or it crashes at runtime.
    content?: {
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
    // Alfresco omits `properties` entirely for nodes that carry no custom
    // properties (e.g. a freshly uploaded file with only cm:auditable), so this
    // is optional — every read must guard with `?.` or it crashes at runtime.
    properties?: Record<string, string | undefined>;
    // Aspect QNames applied to the node (requested via include=aspectNames in the
    // /app/api/bento/multimedia route). Used to tell reviewable from non-reviewable
    // content — see isReviewableEntry in ./reviewable.
    aspectNames?: string[];
  };
}

export interface ImageItem {
  file: AlfrescoFileEntry;
}
