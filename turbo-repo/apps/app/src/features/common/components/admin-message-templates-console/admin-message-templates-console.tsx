"use client";

import { useState } from "react";
import {
  HiClipboardList,
  HiPlus,
  HiPencil,
  HiTrash,
  HiLink,
} from "react-icons/hi";
import { tr } from "@/features/i18n/tr.service";
import { ClientBreadcrumb } from "@/features/common/components/Breadcrumb/ClientBreadcrumb";
import {
  useWebhookDefinitions,
  useMessageTemplates,
  createWebhookDefinitionClient,
  updateWebhookDefinitionClient,
  deleteWebhookDefinitionClient,
  createMessageTemplateClient,
  updateMessageTemplateClient,
  deleteMessageTemplateClient,
  WebhookDefinitionData,
  MessageTemplateData,
} from "@/features/common/providers/client-api.provider";
import { I18nRecord } from "@/features/i18n/i18n.service.types";

interface AdminMessageTemplatesConsoleProps {
  className?: string;
  dict: I18nRecord;
}

const WEBHOOK_KINDS = ["MS_TEAMS", "SLACK", "EMAIL", "SMS", "WEBHOOK"];
const TEMPLATE_ENGINES = [
  "freemarker",
  // "velocity",
  // "mustache",
];

export function AdminMessageTemplatesConsole({
  className = "",
  dict,
}: AdminMessageTemplatesConsoleProps) {
  const [activeTab, setActiveTab] = useState<"webhooks" | "templates">(
    "webhooks"
  );
  const [selectedWebhook, setSelectedWebhook] =
    useState<WebhookDefinitionData | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<MessageTemplateData | null>(null);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  // Data hooks
  const {
    webhooks,
    groupedWebhooks,
    isLoading: webhooksLoading,
    error: webhooksError,
    mutate: mutateWebhooks,
  } = useWebhookDefinitions();

  const {
    templates,
    isLoading: templatesLoading,
    error: templatesError,
    mutate: mutateTemplates,
  } = useMessageTemplates();

  // Form state
  const [webhookForm, setWebhookForm] = useState({
    templateId: "",
    webhookUrl: "",
    webhookKind: "MS_TEAMS",
    template: "",
    useExistingTemplate: true, // New field to toggle between existing/new template
  });

  const [templateForm, setTemplateForm] = useState({
    templateId: "",
    kind: "MS_TEAMS",
    engineExt: "ftl",
    content: "",
  });

  // For webhook creation with new template
  const [newTemplateForWebhook, setNewTemplateForWebhook] = useState({
    templateId: "",
    kind: "MS_TEAMS",
    engineExt: "ftl",
    content: "",
  });

  // Handlers
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let templateNodeRef = webhookForm.template;

      // If creating a new template, create it first
      if (!webhookForm.useExistingTemplate) {
        const newTemplate = (await createMessageTemplateClient({
          site: "mintral",
          kind: newTemplateForWebhook.kind,
          templateId: newTemplateForWebhook.templateId,
          engineExt: newTemplateForWebhook.engineExt,
          content: newTemplateForWebhook.content,
        })) as any; // API response structure
        templateNodeRef = newTemplate.template?.nodeRef || newTemplate.nodeRef;
        await mutateTemplates(); // Refresh templates list
      }

      await createWebhookDefinitionClient({
        site: "mintral",
        templateId: webhookForm.templateId,
        webhookUrl: webhookForm.webhookUrl,
        webhookKind: webhookForm.webhookKind,
        template: templateNodeRef,
      });

      await mutateWebhooks();
      setShowWebhookForm(false);

      // Reset forms
      setWebhookForm({
        templateId: "",
        webhookUrl: "",
        webhookKind: "MS_TEAMS",
        template: "",
        useExistingTemplate: true,
      });
      setNewTemplateForWebhook({
        templateId: "",
        kind: "MS_TEAMS",
        engineExt: "ftl",
        content: "",
      });
    } catch (error) {
      console.error("Error creating webhook:", error);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMessageTemplateClient({
        site: "mintral",
        ...templateForm,
      });
      await mutateTemplates();
      setShowTemplateForm(false);
      setTemplateForm({
        templateId: "",
        kind: "MS_TEAMS",
        engineExt: "ftl",
        content: "",
      });
    } catch (error) {
      console.error("Error creating template:", error);
    }
  };

  const handleDeleteWebhook = async (webhook: WebhookDefinitionData) => {
    if (confirm(tr("messageTemplates.webhooks.deleteConfirm", dict))) {
      try {
        await deleteWebhookDefinitionClient(webhook.nodeRef);
        await mutateWebhooks();
      } catch (error) {
        console.error("Error deleting webhook:", error);
      }
    }
  };

  const handleDeleteTemplate = async (template: MessageTemplateData) => {
    if (confirm(tr("messageTemplates.templates.deleteConfirm", dict))) {
      try {
        await deleteMessageTemplateClient(template.nodeRef);
        await mutateTemplates();
      } catch (error) {
        console.error("Error deleting template:", error);
      }
    }
  };

  const renderWebhookCard = (webhook: WebhookDefinitionData) => (
    <div
      key={webhook.nodeRef}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-medium text-gray-900">
            {webhook.templateId}
          </h4>
          <p className="text-sm text-gray-600 mt-1 break-all">
            {webhook.templateWebhookUrl}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>
              {tr("messageTemplates.webhooks.fields.created", dict)}:{" "}
              {new Date(webhook.created).toLocaleString()}
            </span>
            {webhook.templateRef && (
              <span className="flex items-center gap-1">
                <HiLink className="h-3 w-3" />
                {tr("messageTemplates.webhooks.fields.template", dict)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => setSelectedWebhook(webhook)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
            title={tr("messageTemplates.webhooks.actions.edit", dict)}
          >
            <HiPencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteWebhook(webhook)}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
            title={tr("messageTemplates.webhooks.actions.delete", dict)}
          >
            <HiTrash className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderTemplateCard = (template: MessageTemplateData) => (
    <div
      key={template.nodeRef}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-medium text-gray-900">{template.name}</h4>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-sm text-gray-600">
              {tr(
                `messageTemplates.webhooks.kinds.${template.templateKind}`,
                dict
              )}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {template.engine}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {tr("messageTemplates.templates.fields.created", dict)}:{" "}
            {new Date(template.created).toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => setSelectedTemplate(template)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
            title={tr("messageTemplates.templates.actions.edit", dict)}
          >
            <HiPencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteTemplate(template)}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
            title={tr("messageTemplates.templates.actions.delete", dict)}
          >
            <HiTrash className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="inline-block align-middle relative">
        <div className="p-5 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 dark:text-white w-full">
          <div>
            <nav className="text-sm text-gray-600 mb-4">
              <ClientBreadcrumb
                path={[
                  "breadcrumb.admin",
                  "breadcrumb.console",
                  "breadcrumb.messageTemplates",
                ]}
                rootIcon={<HiClipboardList className="mr-2 h-4 w-4" />}
                dict={dict}
              />
            </nav>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-blue-800 font-medium">
                {tr("messageTemplates.title", dict)}
              </h3>
              <p className="text-blue-700 text-sm mt-1">
                {tr("messageTemplates.description", dict)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("webhooks")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "webhooks"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tr("messageTemplates.tabs.webhooks", dict)}
              </button>
              <button
                onClick={() => setActiveTab("templates")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "templates"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tr("messageTemplates.tabs.templates", dict)}
              </button>
            </nav>
          </div>
        </div>

        <div className="px-5 h-screen w-full overflow-auto">
          {/* Webhooks Tab */}
          {activeTab === "webhooks" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {tr("messageTemplates.webhooks.title", dict)}
                  </h2>
                  <p className="text-gray-600">
                    {tr("messageTemplates.webhooks.description", dict)}
                  </p>
                </div>
                <button
                  onClick={() => setShowWebhookForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <HiPlus className="h-4 w-4" />
                  {tr("messageTemplates.webhooks.createButton", dict)}
                </button>
              </div>

              {webhooksLoading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 bg-gray-200 rounded-lg animate-pulse"
                    ></div>
                  ))}
                </div>
              )}

              {webhooksError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {tr("messageTemplates.errors.loadingFailed", dict)}
                </div>
              )}

              {!webhooksLoading && !webhooksError && (
                <div className="space-y-6">
                  {Object.entries(groupedWebhooks).length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">
                        {tr("messageTemplates.webhooks.noWebhooks", dict)}
                      </p>
                    </div>
                  ) : (
                    Object.entries(groupedWebhooks).map(
                      ([kind, webhooksInKind]) => (
                        <div key={kind} className="space-y-4">
                          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                            {tr(
                              `messageTemplates.webhooks.kinds.${kind}`,
                              dict
                            )}
                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              {webhooksInKind.length}
                            </span>
                          </h3>
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {webhooksInKind.map(renderWebhookCard)}
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              )}

              {/* Webhook Form Modal */}
              {showWebhookForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {tr("messageTemplates.webhooks.form.create", dict)}
                    </h3>
                    <form onSubmit={handleCreateWebhook} className="space-y-4">
                      {/* Basic Webhook Fields */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr(
                              "messageTemplates.webhooks.fields.eventName",
                              dict
                            )}
                          </label>
                          <input
                            type="text"
                            required
                            value={webhookForm.templateId}
                            onChange={(e) =>
                              setWebhookForm({
                                ...webhookForm,
                                templateId: e.target.value,
                              })
                            }
                            placeholder={tr(
                              "messageTemplates.webhooks.form.eventNamePlaceholder",
                              dict
                            )}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr(
                              "messageTemplates.webhooks.fields.webhookKind",
                              dict
                            )}
                          </label>
                          <select
                            value={webhookForm.webhookKind}
                            onChange={(e) => {
                              const kind = e.target.value;
                              setWebhookForm({
                                ...webhookForm,
                                webhookKind: kind,
                              });
                              // Sync webhook kind with template kind for new templates
                              setNewTemplateForWebhook({
                                ...newTemplateForWebhook,
                                kind: kind,
                              });
                            }}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            {WEBHOOK_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {tr(
                                  `messageTemplates.webhooks.kinds.${kind}`,
                                  dict
                                )}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          {tr(
                            "messageTemplates.webhooks.fields.webhookUrl",
                            dict
                          )}
                        </label>
                        <input
                          type="url"
                          required
                          value={webhookForm.webhookUrl}
                          onChange={(e) =>
                            setWebhookForm({
                              ...webhookForm,
                              webhookUrl: e.target.value,
                            })
                          }
                          placeholder={tr(
                            "messageTemplates.webhooks.form.webhookUrlPlaceholder",
                            dict
                          )}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>

                      {/* Template Association Section */}
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-md font-medium text-gray-900 mb-3">
                          {tr(
                            "messageTemplates.webhooks.fields.template",
                            dict
                          )}
                        </h4>

                        {/* Toggle between existing/new template */}
                        <div className="flex gap-4 mb-4">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="templateChoice"
                              checked={webhookForm.useExistingTemplate}
                              onChange={() =>
                                setWebhookForm({
                                  ...webhookForm,
                                  useExistingTemplate: true,
                                })
                              }
                              className="mr-2"
                            />
                            {tr(
                              "messageTemplates.webhooks.form.useExistingTemplate",
                              dict
                            )}
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="templateChoice"
                              checked={!webhookForm.useExistingTemplate}
                              onChange={() =>
                                setWebhookForm({
                                  ...webhookForm,
                                  useExistingTemplate: false,
                                })
                              }
                              className="mr-2"
                            />
                            {tr(
                              "messageTemplates.webhooks.form.createNewTemplate",
                              dict
                            )}
                          </label>
                        </div>

                        {/* Existing Template Selection */}
                        {webhookForm.useExistingTemplate && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              {tr(
                                "messageTemplates.webhooks.form.selectTemplate",
                                dict
                              )}
                            </label>
                            <select
                              value={webhookForm.template}
                              onChange={(e) =>
                                setWebhookForm({
                                  ...webhookForm,
                                  template: e.target.value,
                                })
                              }
                              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                              required={webhookForm.useExistingTemplate}
                            >
                              <option value="">
                                {tr(
                                  "messageTemplates.webhooks.form.selectTemplate",
                                  dict
                                )}
                              </option>
                              {templates
                                .filter(
                                  (template) =>
                                    template.templateKind ===
                                    webhookForm.webhookKind
                                )
                                .map((template) => (
                                  <option
                                    key={template.nodeRef}
                                    value={template.nodeRef}
                                  >
                                    {template.name} ({template.templateId})
                                  </option>
                                ))}
                            </select>
                            {templates.filter(
                              (template) =>
                                template.templateKind ===
                                webhookForm.webhookKind
                            ).length === 0 && (
                              <p className="text-sm text-gray-500 mt-1">
                                No templates available for{" "}
                                {tr(
                                  `messageTemplates.webhooks.kinds.${webhookForm.webhookKind}`,
                                  dict
                                )}
                              </p>
                            )}
                          </div>
                        )}

                        {/* New Template Creation */}
                        {!webhookForm.useExistingTemplate && (
                          <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                            <h5 className="text-sm font-medium text-gray-700">
                              {tr(
                                "messageTemplates.templates.form.create",
                                dict
                              )}
                            </h5>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  {tr(
                                    "messageTemplates.templates.fields.templateId",
                                    dict
                                  )}
                                </label>
                                <input
                                  type="text"
                                  required={!webhookForm.useExistingTemplate}
                                  value={newTemplateForWebhook.templateId}
                                  onChange={(e) =>
                                    setNewTemplateForWebhook({
                                      ...newTemplateForWebhook,
                                      templateId: e.target.value,
                                    })
                                  }
                                  placeholder={tr(
                                    "messageTemplates.templates.form.templateIdPlaceholder",
                                    dict
                                  )}
                                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700">
                                  {tr(
                                    "messageTemplates.templates.fields.engine",
                                    dict
                                  )}
                                </label>
                                <select
                                  value={newTemplateForWebhook.engineExt}
                                  onChange={(e) =>
                                    setNewTemplateForWebhook({
                                      ...newTemplateForWebhook,
                                      engineExt: e.target.value,
                                    })
                                  }
                                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                                >
                                  {TEMPLATE_ENGINES.map((engine) => (
                                    <option key={engine} value={engine}>
                                      {tr(
                                        `messageTemplates.templates.engines.${engine}`,
                                        dict
                                      )}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                {tr(
                                  "messageTemplates.templates.fields.content",
                                  dict
                                )}
                              </label>
                              <textarea
                                required={!webhookForm.useExistingTemplate}
                                rows={8}
                                value={newTemplateForWebhook.content}
                                onChange={(e) =>
                                  setNewTemplateForWebhook({
                                    ...newTemplateForWebhook,
                                    content: e.target.value,
                                  })
                                }
                                placeholder={tr(
                                  "messageTemplates.templates.form.contentPlaceholder",
                                  dict
                                )}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          type="submit"
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                        >
                          {tr("messageTemplates.templates.form.save", dict)}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowWebhookForm(false);
                            // Reset forms when canceling
                            setWebhookForm({
                              templateId: "",
                              webhookUrl: "",
                              webhookKind: "MS_TEAMS",
                              template: "",
                              useExistingTemplate: true,
                            });
                            setNewTemplateForWebhook({
                              templateId: "",
                              kind: "MS_TEAMS",
                              engineExt: "ftl",
                              content: "",
                            });
                          }}
                          className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
                        >
                          {tr("messageTemplates.templates.form.cancel", dict)}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === "templates" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {tr("messageTemplates.templates.title", dict)}
                  </h2>
                  <p className="text-gray-600">
                    {tr("messageTemplates.templates.description", dict)}
                  </p>
                </div>
                <button
                  onClick={() => setShowTemplateForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <HiPlus className="h-4 w-4" />
                  {tr("messageTemplates.templates.createButton", dict)}
                </button>
              </div>

              {templatesLoading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 bg-gray-200 rounded-lg animate-pulse"
                    ></div>
                  ))}
                </div>
              )}

              {templatesError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {tr("messageTemplates.errors.loadingFailed", dict)}
                </div>
              )}

              {!templatesLoading && !templatesError && (
                <div className="space-y-4">
                  {templates.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">
                        {tr("messageTemplates.templates.noTemplates", dict)}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {templates.map(renderTemplateCard)}
                    </div>
                  )}
                </div>
              )}

              {/* Template Form Modal */}
              {showTemplateForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      {tr("messageTemplates.templates.form.create", dict)}
                    </h3>
                    <form onSubmit={handleCreateTemplate} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr(
                              "messageTemplates.templates.fields.templateId",
                              dict
                            )}
                          </label>
                          <input
                            type="text"
                            required
                            value={templateForm.templateId}
                            onChange={(e) =>
                              setTemplateForm({
                                ...templateForm,
                                templateId: e.target.value,
                              })
                            }
                            placeholder={tr(
                              "messageTemplates.templates.form.templateIdPlaceholder",
                              dict
                            )}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {tr(
                              "messageTemplates.templates.fields.templateKind",
                              dict
                            )}
                          </label>
                          <select
                            value={templateForm.kind}
                            onChange={(e) =>
                              setTemplateForm({
                                ...templateForm,
                                kind: e.target.value,
                              })
                            }
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            {WEBHOOK_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {tr(
                                  `messageTemplates.webhooks.kinds.${kind}`,
                                  dict
                                )}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          {tr("messageTemplates.templates.fields.engine", dict)}
                        </label>
                        <select
                          value={templateForm.engineExt}
                          onChange={(e) =>
                            setTemplateForm({
                              ...templateForm,
                              engineExt: e.target.value,
                            })
                          }
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          {TEMPLATE_ENGINES.map((engine) => (
                            <option key={engine} value={engine}>
                              {tr(
                                `messageTemplates.templates.engines.${engine}`,
                                dict
                              )}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          {tr(
                            "messageTemplates.templates.fields.content",
                            dict
                          )}
                        </label>
                        <textarea
                          required
                          rows={10}
                          value={templateForm.content}
                          onChange={(e) =>
                            setTemplateForm({
                              ...templateForm,
                              content: e.target.value,
                            })
                          }
                          placeholder={tr(
                            "messageTemplates.templates.form.contentPlaceholder",
                            dict
                          )}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          type="submit"
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                        >
                          {tr("messageTemplates.templates.form.save", dict)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTemplateForm(false)}
                          className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
                        >
                          {tr("messageTemplates.templates.form.cancel", dict)}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
