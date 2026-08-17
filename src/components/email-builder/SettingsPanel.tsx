import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MERGE_TAGS, type Block, type BuilderDoc, type EmailSettings } from "@/lib/email-builder/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tag } from "lucide-react";

type Props = {
  doc: BuilderDoc;
  selected: Block | null;
  onUpdateBlock: (id: string, patch: any, history?: boolean) => void;
  onUpdateSettings: (patch: Partial<EmailSettings>, history?: boolean) => void;
};

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min = 0, max = 200, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <Input
      type="number" value={value ?? 0} min={min} max={max} step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 text-sm"
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={hexOnly(value)} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-sm" />
    </div>
  );
}

function hexOnly(v: string) { return /^#[0-9a-f]{6}$/i.test(v) ? v : "#000000"; }

function MergeTagButton({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button" className="h-7 px-2 text-xs">
          <Tag className="mr-1 h-3 w-3" /> Merge tag
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {MERGE_TAGS.map((t) => (
          <DropdownMenuItem key={t.value} onSelect={() => onInsert(t.value)}>
            <span className="font-mono text-xs mr-2">{t.value}</span>
            <span className="text-muted-foreground">{t.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Padding({ p, set }: { p: any; set: (patch: any) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Row label="Top"><NumberInput value={p.paddingTop ?? 8} onChange={(v) => set({ paddingTop: v })} /></Row>
      <Row label="Sides"><NumberInput value={p.paddingX ?? 24} onChange={(v) => set({ paddingX: v })} /></Row>
      <Row label="Bottom"><NumberInput value={p.paddingBottom ?? 8} onChange={(v) => set({ paddingBottom: v })} /></Row>
    </div>
  );
}

function Visibility({ p, set }: { p: any; set: (patch: any) => void }) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-xs">
        <Switch checked={!!p.hiddenOnMobile} onCheckedChange={(v) => set({ hiddenOnMobile: v })} />
        Hide on mobile
      </label>
      <label className="flex items-center gap-2 text-xs">
        <Switch checked={!!p.hiddenOnDesktop} onCheckedChange={(v) => set({ hiddenOnDesktop: v })} />
        Hide on desktop
      </label>
    </div>
  );
}

export function SettingsPanel({ doc, selected, onUpdateBlock, onUpdateSettings }: Props) {
  const updateProps = (patch: any) => selected && onUpdateBlock(selected.id, patch);
  const p: any = selected?.props;

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-l bg-card/40">
      <Tabs defaultValue="block" className="flex h-full flex-col">
        <TabsList className="m-3 grid grid-cols-2">
          <TabsTrigger value="block">Block</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
        </TabsList>

        <TabsContent value="block" className="m-0 flex-1 overflow-y-auto px-4 pb-6">
          {!selected ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              Click a block on the canvas to edit it.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold capitalize">{selected.type} block</div>
                <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {selected.id.slice(-6)}
                </span>
              </div>

              {/* Per-type fields */}
              {(selected.type === "heading") && (
                <>
                  <Row label="Text">
                    <Textarea rows={2} value={p.text} onChange={(e) => updateProps({ text: e.target.value })} />
                    <div className="flex justify-end"><MergeTagButton onInsert={(t) => updateProps({ text: (p.text || "") + t })} /></div>
                  </Row>
                  <div className="grid grid-cols-3 gap-2">
                    <Row label="Level">
                      <Select value={String(p.level)} onValueChange={(v) => updateProps({ level: Number(v) })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 2, 3].map((l) => <SelectItem key={l} value={String(l)}>H{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </Row>
                    <Row label="Size"><NumberInput value={p.fontSize} onChange={(v) => updateProps({ fontSize: v })} min={10} max={80} /></Row>
                    <Row label="Weight">
                      <Select value={String(p.fontWeight)} onValueChange={(v) => updateProps({ fontWeight: Number(v) })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{[300, 400, 500, 600, 700, 800].map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}</SelectContent>
                      </Select>
                    </Row>
                  </div>
                  <Row label="Color"><ColorInput value={p.color} onChange={(v) => updateProps({ color: v })} /></Row>
                  <Row label="Align">
                    <Select value={p.align} onValueChange={(v) => updateProps({ align: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
                    </Select>
                  </Row>
                </>
              )}

              {(selected.type === "paragraph" || selected.type === "text") && (
                <>
                  <Row label="Text">
                    <Textarea rows={6} value={p.text} onChange={(e) => updateProps({ text: e.target.value })} />
                    <div className="flex justify-end"><MergeTagButton onInsert={(t) => updateProps({ text: (p.text || "") + t })} /></div>
                  </Row>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="Font size"><NumberInput value={p.fontSize} onChange={(v) => updateProps({ fontSize: v })} min={10} max={36} /></Row>
                    <Row label="Line height"><NumberInput value={p.lineHeight} onChange={(v) => updateProps({ lineHeight: v })} min={1} max={3} step={0.1} /></Row>
                  </div>
                  <Row label="Color"><ColorInput value={p.color} onChange={(v) => updateProps({ color: v })} /></Row>
                  <Row label="Align">
                    <Select value={p.align} onValueChange={(v) => updateProps({ align: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
                    </Select>
                  </Row>
                </>
              )}

              {(selected.type === "image" || selected.type === "logo") && (
                <>
                  <Row label="Image URL"><Input value={p.src} onChange={(e) => updateProps({ src: e.target.value })} /></Row>
                  <Row label="Alt text"><Input value={p.alt} onChange={(e) => updateProps({ alt: e.target.value })} placeholder="Describe the image" /></Row>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="Width (px, 0 = full)"><NumberInput value={p.width} onChange={(v) => updateProps({ width: v })} min={0} max={1200} /></Row>
                    <Row label="Border radius"><NumberInput value={p.borderRadius} onChange={(v) => updateProps({ borderRadius: v })} min={0} max={50} /></Row>
                  </div>
                  <Row label="Link (optional)"><Input value={p.href || ""} onChange={(e) => updateProps({ href: e.target.value })} placeholder="https://" /></Row>
                  <Row label="Align">
                    <Select value={p.align} onValueChange={(v) => updateProps({ align: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
                    </Select>
                  </Row>
                </>
              )}

              {selected.type === "button" && (
                <>
                  <Row label="Button text"><Input value={p.text} onChange={(e) => updateProps({ text: e.target.value })} /></Row>
                  <Row label="Link URL"><Input value={p.href} onChange={(e) => updateProps({ href: e.target.value })} placeholder="https://" /></Row>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="Background"><ColorInput value={p.bgColor} onChange={(v) => updateProps({ bgColor: v })} /></Row>
                    <Row label="Text color"><ColorInput value={p.color} onChange={(v) => updateProps({ color: v })} /></Row>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Row label="Font size"><NumberInput value={p.fontSize} onChange={(v) => updateProps({ fontSize: v })} min={10} max={28} /></Row>
                    <Row label="Weight">
                      <Select value={String(p.fontWeight)} onValueChange={(v) => updateProps({ fontWeight: Number(v) })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{[400, 500, 600, 700].map((w) => <SelectItem key={w} value={String(w)}>{w}</SelectItem>)}</SelectContent>
                      </Select>
                    </Row>
                    <Row label="Radius"><NumberInput value={p.borderRadius} onChange={(v) => updateProps({ borderRadius: v })} min={0} max={40} /></Row>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="V padding"><NumberInput value={p.paddingY} onChange={(v) => updateProps({ paddingY: v })} min={4} max={40} /></Row>
                    <Row label="H padding"><NumberInput value={p.paddingX2} onChange={(v) => updateProps({ paddingX2: v })} min={4} max={60} /></Row>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={!!p.fullWidth} onCheckedChange={(v) => updateProps({ fullWidth: v })} />
                    Full width
                  </label>
                  <Row label="Align">
                    <Select value={p.align} onValueChange={(v) => updateProps({ align: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
                    </Select>
                  </Row>
                </>
              )}

              {selected.type === "divider" && (
                <>
                  <Row label="Color"><ColorInput value={p.color} onChange={(v) => updateProps({ color: v })} /></Row>
                  <Row label="Thickness"><NumberInput value={p.thickness} onChange={(v) => updateProps({ thickness: v })} min={1} max={10} /></Row>
                </>
              )}

              {selected.type === "spacer" && (
                <Row label="Height (px)"><NumberInput value={p.height} onChange={(v) => updateProps({ height: v })} min={4} max={200} /></Row>
              )}

              {selected.type === "columns" && (
                <>
                  <Row label="Layout">
                    <Select value={p.ratio} onValueChange={(v) => updateProps({ ratio: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1:1">2 cols · 50/50</SelectItem>
                        <SelectItem value="1:2">2 cols · 33/67</SelectItem>
                        <SelectItem value="2:1">2 cols · 67/33</SelectItem>
                        <SelectItem value="1:1:1">3 cols · 33/33/33</SelectItem>
                      </SelectContent>
                    </Select>
                  </Row>
                  <Row label="Gap"><NumberInput value={p.gap} onChange={(v) => updateProps({ gap: v })} min={0} max={48} /></Row>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={!!p.stackOnMobile} onCheckedChange={(v) => updateProps({ stackOnMobile: v })} />
                    Stack columns on mobile
                  </label>
                  <Row label="Column text">
                    <Textarea rows={3} value={(p.columns?.[0]?.[0]?.props?.text) || ""}
                      onChange={(e) => {
                        const cols = (p.columns || []).map((c: any[]) => c.slice());
                        if (cols[0]?.[0]) cols[0][0] = { ...cols[0][0], props: { ...cols[0][0].props, text: e.target.value } };
                        updateProps({ columns: cols });
                      }} />
                  </Row>
                </>
              )}

              {selected.type === "hero" && (
                <>
                  <Row label="Image URL"><Input value={p.imageSrc} onChange={(e) => updateProps({ imageSrc: e.target.value })} /></Row>
                  <Row label="Alt text"><Input value={p.imageAlt} onChange={(e) => updateProps({ imageAlt: e.target.value })} /></Row>
                  <Row label="Title"><Input value={p.title} onChange={(e) => updateProps({ title: e.target.value })} /></Row>
                  <Row label="Subtitle"><Textarea rows={2} value={p.subtitle} onChange={(e) => updateProps({ subtitle: e.target.value })} /></Row>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="CTA text"><Input value={p.ctaText} onChange={(e) => updateProps({ ctaText: e.target.value })} /></Row>
                    <Row label="CTA link"><Input value={p.ctaHref} onChange={(e) => updateProps({ ctaHref: e.target.value })} /></Row>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="Text color"><ColorInput value={p.textColor} onChange={(v) => updateProps({ textColor: v })} /></Row>
                    <Row label="Overlay"><Input value={p.overlayColor} onChange={(e) => updateProps({ overlayColor: e.target.value })} /></Row>
                  </div>
                </>
              )}

              {selected.type === "card" && (
                <>
                  <Row label="Title"><Input value={p.title} onChange={(e) => updateProps({ title: e.target.value })} /></Row>
                  <Row label="Body"><Textarea rows={3} value={p.body} onChange={(e) => updateProps({ body: e.target.value })} /></Row>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="CTA text"><Input value={p.ctaText} onChange={(e) => updateProps({ ctaText: e.target.value })} /></Row>
                    <Row label="CTA link"><Input value={p.ctaHref} onChange={(e) => updateProps({ ctaHref: e.target.value })} /></Row>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="Border color"><ColorInput value={p.borderColor} onChange={(v) => updateProps({ borderColor: v })} /></Row>
                    <Row label="Radius"><NumberInput value={p.borderRadius} onChange={(v) => updateProps({ borderRadius: v })} min={0} max={32} /></Row>
                  </div>
                </>
              )}

              {selected.type === "event" && (
                <>
                  <Row label="Title"><Input value={p.title} onChange={(e) => updateProps({ title: e.target.value })} /></Row>
                  <Row label="Date label"><Input value={p.dateLabel} onChange={(e) => updateProps({ dateLabel: e.target.value })} /></Row>
                  <Row label="Time label"><Input value={p.timeLabel} onChange={(e) => updateProps({ timeLabel: e.target.value })} /></Row>
                  <Row label="Location"><Input value={p.location} onChange={(e) => updateProps({ location: e.target.value })} /></Row>
                  <div className="grid grid-cols-2 gap-2">
                    <Row label="CTA text"><Input value={p.ctaText} onChange={(e) => updateProps({ ctaText: e.target.value })} /></Row>
                    <Row label="CTA link"><Input value={p.ctaHref} onChange={(e) => updateProps({ ctaHref: e.target.value })} /></Row>
                  </div>
                </>
              )}

              {selected.type === "social" && (
                <>
                  <Row label="Icon color"><ColorInput value={p.iconColor} onChange={(v) => updateProps({ iconColor: v })} /></Row>
                  <Row label="Align">
                    <Select value={p.align} onValueChange={(v) => updateProps({ align: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
                    </Select>
                  </Row>
                  <div className="space-y-2">
                    {p.links.map((l: any, i: number) => (
                      <div key={i} className="grid grid-cols-[100px_1fr_auto] gap-1.5">
                        <Select value={l.network} onValueChange={(v) => {
                          const links = [...p.links]; links[i] = { ...l, network: v }; updateProps({ links });
                        }}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["twitter", "linkedin", "facebook", "instagram", "youtube", "website"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input value={l.href} placeholder="https://" onChange={(e) => {
                          const links = [...p.links]; links[i] = { ...l, href: e.target.value }; updateProps({ links });
                        }} className="h-8" />
                        <Button size="sm" variant="ghost" onClick={() => updateProps({ links: p.links.filter((_: any, k: number) => k !== i) })}>×</Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => updateProps({ links: [...p.links, { network: "website", href: "https://" }] })}>+ Add link</Button>
                  </div>
                </>
              )}

              {selected.type === "footer" && (
                <>
                  <Row label="Company name"><Input value={p.companyName} onChange={(e) => updateProps({ companyName: e.target.value })} /></Row>
                  <Row label="Address / legal line"><Textarea rows={2} value={p.address} onChange={(e) => updateProps({ address: e.target.value })} /></Row>
                  <Row label="Color"><ColorInput value={p.color} onChange={(v) => updateProps({ color: v })} /></Row>
                </>
              )}

              {selected.type === "unsubscribe" && (
                <>
                  <Row label="Link text"><Input value={p.text} onChange={(e) => updateProps({ text: e.target.value })} /></Row>
                  <Row label="Color"><ColorInput value={p.color} onChange={(v) => updateProps({ color: v })} /></Row>
                </>
              )}

              {selected.type === "html" && (
                <Row label="Custom HTML">
                  <Textarea rows={10} className="font-mono text-xs" value={p.html} onChange={(e) => updateProps({ html: e.target.value })} />
                </Row>
              )}

              <div className="pt-2 border-t" />
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Spacing</div>
              <Padding p={p} set={updateProps} />
              <Row label="Background"><ColorInput value={p.bgColor || "#ffffff"} onChange={(v) => updateProps({ bgColor: v })} /></Row>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Visibility</div>
              <Visibility p={p} set={updateProps} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="template" className="m-0 flex-1 overflow-y-auto px-4 pb-6 space-y-4">
          <Row label="Content width">
            <NumberInput value={doc.settings.contentWidth} onChange={(v) => onUpdateSettings({ contentWidth: v })} min={400} max={800} step={20} />
          </Row>
          <Row label="Page background"><ColorInput value={doc.settings.backgroundColor} onChange={(v) => onUpdateSettings({ backgroundColor: v })} /></Row>
          <Row label="Content background"><ColorInput value={doc.settings.contentBackground} onChange={(v) => onUpdateSettings({ contentBackground: v })} /></Row>
          <Row label="Text color"><ColorInput value={doc.settings.textColor} onChange={(v) => onUpdateSettings({ textColor: v })} /></Row>
          <Row label="Link color"><ColorInput value={doc.settings.linkColor} onChange={(v) => onUpdateSettings({ linkColor: v })} /></Row>
          <Row label="Font family">
            <Select value={doc.settings.fontFamily} onValueChange={(v) => onUpdateSettings({ fontFamily: v })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial, Helvetica, sans-serif">Arial</SelectItem>
                <SelectItem value="Helvetica, Arial, sans-serif">Helvetica</SelectItem>
                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                <SelectItem value="'Trebuchet MS', sans-serif">Trebuchet MS</SelectItem>
                <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                <SelectItem value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">System UI</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
