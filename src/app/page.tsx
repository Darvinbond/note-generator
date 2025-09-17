"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { DownloadIcon, Upload, Menu, Settings2, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import {
  DialogDrawer,
} from "@/components/ui/dialog-drawer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [week, setWeek] = useState(1);
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [weeklySelections, setWeeklySelections] = useState<{ [week: number]: string[] }>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      setSheetData(data);
    } else {
      setColumnCount(0);
      setSelectedColumn(null);
      setSheetData([]);
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
      if (window.innerWidth < 768) {
        setIsSheetOpen(true);
      }
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
    if (isCustomMode) {
      // Custom mode logic will be handled by a different function
      return;
    }
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

  const SidePanelContent = ({ onGenerateClick }: { onGenerateClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) => (
    <div className="p-4 h-full flex flex-col">
      <h2 className="text-base font-semibold mb-6 text-gray-800">Note Generator</h2>

      <div className="mb-6">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Source File</label>
        <div className="mt-2">
          {!selectedFile ? (
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:bg-gray-100 transition-colors"
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={(ev) => {
                ev.preventDefault();
                const file = ev.dataTransfer?.files?.[0];
                if (file) void acceptAndInspectFile(file);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-sm font-medium text-gray-700">Click to upload or drag and drop</div>
              <div className="text-xs text-gray-500">XLS, XLSX or CSV</div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2">
              <div className="truncate text-sm text-gray-800">{selectedFile.name}</div>
              <Button type="button" variant="ghost" size="sm" onClick={resetFileState}>Remove</Button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept=".xls,.xlsx,.csv" onChange={handleFileChange} className="hidden" />
        </div>
      </div>

      {selectedFile && (
        <>
          <div className="mb-6">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Generation Mode</label>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-gray-200 p-1">
              <Button variant={!isCustomMode ? "default" : "ghost"} size="sm" onClick={() => setIsCustomMode(false)}>Standard</Button>
              <Button variant={isCustomMode ? "default" : "ghost"} size="sm" onClick={() => setIsCustomMode(true)}>Custom</Button>
            </div>
          </div>

          <div className="flex-1">
            {isCustomMode ? (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Scheme of Work</label>
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsModalOpen(true)}
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    Configure Scheme
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Select Column</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from({ length: columnCount }, (_, i) => i + 1).map((col) => (
                    <label
                      key={col}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors cursor-pointer ${
                        selectedColumn === col ? "bg-primary text-primary-foreground" : "hover:bg-gray-100"
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedColumn"
                        className="sr-only"
                        checked={selectedColumn === col}
                        onChange={() => setSelectedColumn(col)}
                      />
                      <span>{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isCustomMode && (
            <div className="mt-auto pt-4 border-t border-gray-200">
              <Button
                type="button"
                className="w-full"
                disabled={status === "streaming" || !selectedColumn}
                onClick={onGenerateClick}
              >
                {status === "streaming" ? "Generating…" : "Generate Notes"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={`w-full mx-auto px-[16px] md:px-6 relative size-full h-screen transition-all duration-300 ${hasFile ? 'md:!pr-[33%]' : 'max-w-5xl'}`}>
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
                        <DownloadIcon size={18} />
                        <span className="ml-1">{exporting === 'docx' ? 'Preparing DOCX…' : 'Save as DOCX'}</span>
                      </Button>
                      <Button
                        variant="ghost"
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
                        <DownloadIcon size={18} />
                        <span className="ml-1">{exporting === 'pdf' ? 'Preparing PDF…' : 'Save as PDF'}</span>
                      </Button>
                    </div>
                    {exportError && (
                      <div className="mt-2 text-xs text-red-600">{exportError}</div>
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
              <Upload className="h-5 w-5" />
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

        {/* Desktop Sidebar */}
        <div
          className={`hidden md:block fixed top-0 right-0 h-full w-1/3 bg-gray-50 border-l border-gray-200 shadow-lg transition-transform duration-300 ease-in-out transform ${
            hasFile ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ zIndex: 40 }}
        >
          <SidePanelContent onGenerateClick={handleFileSubmit} />
        </div>

        {/* Mobile Drawer */}
        <div className="md:hidden">
          {hasFile && (
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="fixed bottom-6 right-6 z-30 rounded-full shadow-lg h-14 w-14">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open settings</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full">
                <SheetHeader>
                  <SheetTitle>Note Generator Settings</SheetTitle>
                </SheetHeader>
                <SidePanelContent onGenerateClick={(e) => {
                  handleFileSubmit(e);
                  setIsSheetOpen(false);
                }} />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
      <DialogDrawer
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        trigger={null}
        title={`Custom Mode - Week ${week}`}
        description="Select cells for the current week"
        dialogClassName="max-w-3xl w-full"
        footer={
          <div className="flex justify-between w-full">
            <div>
              <Button variant="outline" onClick={() => setWeek(Math.max(1, week - 1))} disabled={week === 1}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <span className="mx-4">Week {week}</span>
              <Button variant="outline" onClick={() => setWeek(week + 1)}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <Button
              disabled={status === "streaming" || Object.keys(weeklySelections).length === 0}
                          onClick={() => {
                            setIsModalOpen(false);
                            setIsSheetOpen(false);
                            setRunHasFile(true);
                            void sendMessage(
                              { text: 'Generate notes for the term' },
                              { body: { model, weeklySelections } }
                            );
                          }}
                        >
                          {status === "streaming" ? "Generating…" : "Generate Notes"}
              <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {sheetData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    const cellContent = cell.toString();
                    const isSelected = weeklySelections[week]?.includes(cellContent);
                    const isSelectedInAnotherWeek = Object.entries(weeklySelections).some(
                      ([w, cells]) => parseInt(w) !== week && cells.includes(cellContent)
                    );
                    return (
                      <td
                        key={cellIndex}
                        className={`border p-2 cursor-pointer relative ${
                          isSelected ? "bg-emerald-50" : "hover:bg-gray-100"
                        } ${isSelectedInAnotherWeek ? "cursor-not-allowed opacity-50" : ""}`}
                        onClick={() => {
                          if (isSelectedInAnotherWeek) return;
                          setWeeklySelections(prev => {
                            const newSelections = { ...prev };
                            if (isSelected) {
                              newSelections[week] = newSelections[week].filter(c => c !== cellContent);
                            } else {
                              newSelections[week] = [...(newSelections[week] || []), cellContent];
                            }
                            return newSelections;
                          });
                        }}
                      >
                        {cell}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-base">
                            {week}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogDrawer>
    </div>
  );
};

export default ChatBotDemo;
