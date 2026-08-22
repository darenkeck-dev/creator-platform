"use client";

import type { PurchaseLink } from "@media-manager/contracts";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePurchaseLink } from "@/lib/music-ui";

export function PurchaseLinkEditor({
  links,
  onChange,
  disabled = false,
}: {
  links: PurchaseLink[];
  onChange: (links: PurchaseLink[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      {links.map((link, index) => (
        <div className="grid gap-2 sm:grid-cols-[minmax(8rem,0.7fr)_minmax(12rem,1.3fr)_auto]" key={index}>
          <Input
            aria-label={`Purchase link ${index + 1} label`}
            disabled={disabled}
            maxLength={80}
            onChange={(event) => onChange(updatePurchaseLink(links, index, "label", event.target.value))}
            placeholder="Bandcamp"
            value={link.label}
          />
          <Input
            aria-label={`Purchase link ${index + 1} URL`}
            disabled={disabled}
            onChange={(event) => onChange(updatePurchaseLink(links, index, "url", event.target.value))}
            placeholder="https://..."
            type="url"
            value={link.url}
          />
          <Button
            aria-label={`Remove purchase link ${index + 1}`}
            disabled={disabled}
            onClick={() => onChange(links.filter((_, linkIndex) => linkIndex !== index))}
            size="sm"
            type="button"
            variant="ghost"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        disabled={disabled || links.length >= 20}
        onClick={() => onChange([...links, { label: "", url: "" }])}
        size="sm"
        type="button"
        variant="outline"
      >
        <Plus className="h-4 w-4" /> Add link
      </Button>
    </div>
  );
}
