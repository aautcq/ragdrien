import { HomePromptInput } from "@/components/home-prompt-input";

export default function Home() {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col justify-center py-1 md:py-4 px-1 md:px-0">
      <h1 className="text-center text-3xl font-bold mb-3">Ask me anything</h1>
      <p className="text-center text-muted-foreground mb-12">I&apos;m an expert about Adrien Autricque.</p>
      <HomePromptInput />
    </div>
  );
}
