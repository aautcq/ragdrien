import { HomePromptInput } from "@/components/home-prompt-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function Home() {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col justify-center items-center py-1 md:py-4 px-1 md:px-0">
      <Avatar size="xl" className="mb-8">
        <AvatarImage src="avatar.jpg" />
        <AvatarFallback>AA</AvatarFallback>
      </Avatar>
      <h1 className="text-center text-3xl font-bold mb-3">👋 Hi, I&apos;m Adrien Autricque</h1>
      <p className="text-center text-muted-foreground mb-12">Ask me anything</p>
      <HomePromptInput />
    </div>
  );
}
