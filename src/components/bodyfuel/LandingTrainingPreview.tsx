import { Check, Dumbbell } from "lucide-react";

export function LandingTrainingPreview() {
  return <div className="landing-app-screen w-full max-w-sm rounded-lg border border-border bg-background p-5">
    <p className="text-xs font-semibold text-primary">BODYFUEL · TRAINING</p>
    <h3 className="mt-4 text-2xl font-semibold">Ganzkörper</h3>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">Beispielansicht · kein persönlicher Trainingsplan</p>
    <div className="mt-6 flex items-center gap-3 border-y border-border py-4"><Dumbbell className="h-5 w-5 text-primary" /><span className="text-sm font-medium">Übungen & Sätze</span></div>
    <ol className="divide-y divide-border">{[{name:"Kniebeuge",sets:"3 Sätze · 8–12 Wiederholungen"},{name:"Rudern",sets:"3 Sätze · 8–12 Wiederholungen"},{name:"Liegestütz",sets:"3 Sätze · 6–12 Wiederholungen"}].map((exercise,i)=><li key={exercise.name} className="flex items-start gap-3 py-5"><span className="text-sm font-semibold text-primary">0{i+1}</span><div><p className="text-sm font-semibold">{exercise.name}</p><p className="mt-2 text-xs text-muted-foreground">{exercise.sets}</p></div></li>)}</ol>
    <p className="mt-3 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Check className="h-4 w-4 text-primary" /> Gewichte & Wiederholungen dokumentieren</p>
  </div>;
}