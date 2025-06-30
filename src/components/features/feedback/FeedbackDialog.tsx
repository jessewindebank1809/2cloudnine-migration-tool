"use client";

import React, { useState, useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Loader2, Paperclip, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// File upload constraints
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "text/plain", "application/pdf"];
const MAX_FILES = 3;

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const [session, setSession] = useState<any>(null);
  const [type, setType] = useState<string>("bug");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionData = await authClient.getSession();
        if (sessionData?.data?.user) {
          setSession(sessionData.data);
        }
      } catch (err) {
        console.error("Failed to fetch session:", err);
      }
    };
    
    if (open) {
      fetchSession();
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    const errors: string[] = [];

    files.forEach((file) => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: File type not allowed`);
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File too large (max 5MB)`);
      } else if (attachments.length + validFiles.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files allowed`);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join(", "));
    } else {
      setError(null);
    }

    setAttachments([...attachments, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      setError("Please enter a message");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Convert attachments to base64
      const attachmentData = await Promise.all(
        attachments.map(async (file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
          data: await fileToBase64(file),
        }))
      );

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          message,
          url: window.location.href,
          userAgent: navigator.userAgent,
          attachments: attachmentData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit feedback");
      }

      setSuccess(true);
      setMessage("");
      setType("bug");
      setAttachments([]);

      // Close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false);
        // Reset success state after dialog closes
        setTimeout(() => setSuccess(false), 300);
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit feedback",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      onOpenChange(false);
      // Reset form after close animation
      setTimeout(() => {
        setMessage("");
        setType("bug");
        setError(null);
        setSuccess(false);
        setAttachments([]);
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help us improve by reporting bugs or suggesting features. Your
              feedback will be sent to our development team.
            </DialogDescription>
          </DialogHeader>

          {success ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-medium">
                Thank you for your feedback!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                We&apos;ll review it and get back to you if needed.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={type}
                  onValueChange={setType}
                  disabled={submitting}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">🐛 Bug Report</SelectItem>
                    <SelectItem value="feature">✨ Feature Request</SelectItem>
                    <SelectItem value="improvement">💡 Improvement</SelectItem>
                    <SelectItem value="other">💬 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder={
                    type === "bug"
                      ? "Describe the issue you're experiencing..."
                      : type === "feature"
                      ? "Describe the feature you'd like to see..."
                      : "Share your feedback..."
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={submitting}
                  className="min-h-[120px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachments">Attachments (optional)</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={submitting || attachments.length >= MAX_FILES}
                      onClick={() => document.getElementById("file-input")?.click()}
                    >
                      <Paperclip className="h-4 w-4 mr-2" />
                      Add Files
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Max {MAX_FILES} files, 5MB each
                    </span>
                  </div>
                  <input
                    id="file-input"
                    type="file"
                    multiple
                    accept={ALLOWED_FILE_TYPES.join(",")}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {attachments.length > 0 && (
                    <div className="space-y-1">
                      {attachments.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 text-sm bg-muted rounded-md"
                        >
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground mx-2">
                            {(file.size / 1024).toFixed(1)}KB
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => removeAttachment(index)}
                            disabled={submitting}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {!success && (
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !message.trim()}>
                {submitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {submitting ? "Sending..." : "Send Feedback"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
