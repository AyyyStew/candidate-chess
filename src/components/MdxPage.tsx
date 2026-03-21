import type { ComponentType } from "react";

interface Props {
  Content: ComponentType;
}

export default function MdxPage({ Content }: Props) {
  return (
    <main className="max-w-2xl mx-auto px-8 py-16">
      <div className="flex flex-col gap-6 [&_h1]:font-black [&_h1]:text-3xl [&_h1]:tracking-tight [&_h1]:mb-2 [&_h2]:font-bold [&_h2]:text-lg [&_h2]:text-text [&_h2]:mt-6 [&_p]:text-muted [&_p]:text-sm [&_p]:leading-relaxed [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:text-accent-hi [&_a]:transition-colors">
        <Content />
      </div>
    </main>
  );
}
