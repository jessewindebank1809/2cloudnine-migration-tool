"use client";

import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackDialog } from "./FeedbackDialog";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-background/95 backdrop-blur-sm border-border/50 z-50"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
      >
        <MessageSquare className="h-5 w-5" />
      </Button>

      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
