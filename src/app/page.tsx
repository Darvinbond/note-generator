"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { DownloadIcon } from "lucide-react";
import * as XLSX from "xlsx";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { TailwindClassSafelist } from "@/components/ai-elements/tw-safelist";

const models = [
  { name: "GPT 4o", value: "openai/gpt-4o" },
  { name: "Deepseek R1", value: "deepseek/deepseek-r1" },
];

const ChatBotDemo = () => {
  const [model] = useState<string>(models[0].value);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [runHasFile, setRunHasFile] = useState(false);
  const [columnCount, setColumnCount] = useState<number>(0);
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null); // 1-based index
  const [showDownloadMenu, setShowDownloadMenu] = useState(false); // controls visibility of the assistant download message
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false); // controls the actions visibility
  const [exporting, setExporting] = useState<null | 'docx' | 'pdf'>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const getLatestAssistantText = useMemo(() => {
    return () =>
      messages
        .filter((m) => m.role === "assistant")
        .map((m: any) =>
          m.parts
            .filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join("")
        )
        .join("\n\n");
  }, [messages]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetFileState = () => {
    setSelectedFile(null);
    setColumnCount(0);
    setSelectedColumn(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const processWorkbookForColumns = (wb: XLSX.WorkBook) => {
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const ref = ws["!ref"];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      const cols = range.e.c - range.s.c + 1;
      setColumnCount(cols > 0 ? cols : 0);
      setSelectedColumn(cols > 0 ? 1 : null);
    } else {
      setColumnCount(0);
      setSelectedColumn(null);
    }
  };

  const acceptAndInspectFile = async (f: File) => {
    const ok = [".xls", ".xlsx", ".csv"].some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!ok) {
      alert("Please select an .xls, .xlsx, or .csv file.");
      resetFileState();
      return;
    }
    setSelectedFile(f);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      processWorkbookForColumns(wb);
    } catch (err) {
      console.error("Failed to read spreadsheet for column detection", err);
      resetFileState();
      alert("Could not read the spreadsheet. Please try another file.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      resetFileState();
      return;
    }
    void acceptAndInspectFile(f);
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedColumn) {
      alert("Please select a column to generate from.");
      return;
    }
    // Read as base64
    const buf = await selectedFile.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    setRunHasFile(true);
    setShowDownloadMenu(false);
    setIsDownloadMenuOpen(false);
    await sendMessage(
      { text: "Generate notes from uploaded file" },
      { body: { model, selectedColumn, file: { name: selectedFile.name, type: selectedFile.type, data: base64 } } }
    );
  };

  // When streaming finishes for a file-backed run, expose download actions
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current === "streaming" && status !== "streaming" && runHasFile) {
      setShowDownloadMenu(true);
      setIsDownloadMenuOpen(false);
      setRunHasFile(false);
    }
    prevStatus.current = status;
  }, [status, runHasFile]);

  const hasFile = !!selectedFile;

  return (
    <div className={`w-full mx-auto px-[16px] md:px-6 relative size-full h-screen transition-all duration-300 ${hasFile ? '!pr-[33%]' : 'max-w-5xl'}`}>
      <TailwindClassSafelist />
      <div className="w-full flex flex-col h-full relative">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "assistant" && (
                  <Sources>
                    <SourcesTrigger
                      count={
                        message.parts.filter((part: any) => part.type === "source-url").length
                      }
                    />
                    {message.parts
                      .filter((part: any) => part.type === "source-url")
                      .map((part: any, i: number) => (
                        <SourcesContent key={`${message.id}-${i}`}>
                          <Source href={part.url} title={part.url} />
                        </SourcesContent>
                      ))}
                  </Sources>
                )}
                <Message from={message.role}>
                  <MessageContent>
                    {message.parts.map((part: any, i: number) => {
                      switch (part.type) {
                        case "text":
                          return (
                            <Response
                             key={`${message.id}-${i}`}>{part.text}</Response>
                          );
                        case "reasoning":
                          return (
                            <Reasoning
                              key={`${message.id}-${i}`}
                              className="w-full"
                              isStreaming={status === "streaming"}
                            >
                              <ReasoningTrigger />
                              <ReasoningContent>{part.text}</ReasoningContent>
                            </Reasoning>
                          );
                        default:
                          return null;
                      }
                    })}
                  </MessageContent>
                </Message>
              </div>
            ))}
            {status === "submitted" && <Loader />}
            {showDownloadMenu && (
              <Message from="assistant">
                <MessageContent>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setExportError(null);
                          setIsDownloadMenuOpen((v) => !v);
                        }}
                        aria-label="Download"
                      >
                        <DownloadIcon size={18} />
                        <span className="ml-1">Download</span>
                      </Button>
                    </div>
                    {isDownloadMenuOpen && (
                      <div className="w-full max-w-xs rounded-md border bg-background p-2 shadow-sm">
                        <div className="text-sm mb-2 text-muted-foreground">Export generated notes as:</div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={exporting !== null}
                            onClick={async () => {
                              try {
                                setExportError(null);
                                setExporting('docx');
                                const content = getLatestAssistantText();
                                const res = await fetch("/api/export", {
                                  method: "POST",
                                  headers: { "content-type": "application/json" },
                                  body: JSON.stringify({ format: "docx", content }),
                                });
                                if (!res.ok) throw new Error(`Export failed (${res.status})`);
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "notes.docx";
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch (e: any) {
                                setExportError(e?.message || 'Failed to export DOCX');
                              } finally {
                                setExporting(null);
                              }
                            }}
                          >
                            {exporting === 'docx' ? 'Preparing DOCX…' : 'Download DOCX'}
                          </Button>
                          <Button
                            size="sm"
                            disabled={exporting !== null}
                            onClick={async () => {
                              try {
                                setExportError(null);
                                setExporting('pdf');
                                const content = getLatestAssistantText();
                                const res = await fetch("/api/export", {
                                  method: "POST",
                                  headers: { "content-type": "application/json" },
                                  body: JSON.stringify({ format: "pdf", content }),
                                });
                                if (!res.ok) throw new Error(`Export failed (${res.status})`);
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = "notes.pdf";
                                a.click();
                                URL.revokeObjectURL(url);
                              } catch (e: any) {
                                setExportError(e?.message || 'Failed to export PDF');
                              } finally {
                                setExporting(null);
                              }
                            }}
                          >
                            {exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
                          </Button>
                        </div>
                        {exportError && (
                          <div className="mt-2 text-xs text-red-600">{exportError}</div>
                        )}
                      </div>
                    )}
                  </div>
                </MessageContent>
              </Message>
            )}
          </ConversationContent>
          <ConversationScrollButton aria-label="Scroll to bottom" />
        </Conversation>

        {/* Floating upload button when no file is selected */}
        {!selectedFile && (
          <div className="fixed bottom-6 right-6 z-30">
            <Button 
              variant="outline" 
              size="lg" 
              className="rounded-full shadow-lg h-14 w-14 p-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span className="sr-only">Upload file</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* File Upload Panel */}
        <div 
          className={`fixed top-0 right-0 h-full w-1/3 bg-background border-l shadow-lg transition-transform duration-300 ease-in-out transform ${
            hasFile ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ zIndex: 40 }}
        >
          <div className="p-6 h-full overflow-y-auto">
            <div className="flex flex-col h-full">
              <h2 className="text-lg font-semibold mb-4">Document Generator</h2>
              
              <form onSubmit={handleFileSubmit} className="flex-1 flex flex-col">
                <div className="flex-1">
                  <div className="rounded-md border p-3 mb-4">
                    {!selectedFile ? (
                      <div
                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center hover:bg-accent/40 transition-colors"
                        onDragOver={(ev) => {
                          ev.preventDefault();
                        }}
                        onDrop={(ev) => {
                          ev.preventDefault();
                          const file = ev.dataTransfer?.files?.[0];
                          if (file) void acceptAndInspectFile(file);
                        }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="text-sm font-medium">Click to upload or drag and drop</div>
                        <div className="text-xs text-muted-foreground">XLS, XLSX or CSV</div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 rounded-md bg-accent/40 px-3 py-2">
                        <div className="truncate text-sm"><span className="text-muted-foreground">File:</span> {selectedFile.name}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={resetFileState}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {columnCount > 0 && (
                    <div className="flex flex-col gap-2 mb-4">
                      <div className="text-sm text-muted-foreground">Select column to generate from</div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: columnCount }, (_, i) => i + 1).map((col) => (
                          <label
                            key={col}
                            className={
                              "inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm transition-colors cursor-pointer " +
                              (selectedColumn === col ? "bg-accent" : "hover:bg-accent/60")
                            }
                          >
                            <input
                              type="radio"
                              name="selectedColumn"
                              className="h-4 w-4"
                              checked={selectedColumn === col}
                              onChange={() => setSelectedColumn(col)}
                            />
                            <span>Column {col}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {selectedFile && selectedColumn && (
                  <div className="mt-auto pt-4 border-t">
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={status === "streaming"}
                    >
                      {status === "streaming" ? "Generating…" : "Generate Notes"}
                    </Button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBotDemo;
