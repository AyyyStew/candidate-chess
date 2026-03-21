import { useParams, Link, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import MdxPage from "../components/MdxPage";

const postModules = import.meta.glob("../content/posts/*.mdx");

export default function NewsPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const key = `../content/posts/${slug}.mdx`;

  if (!postModules[key]) {
    return <Navigate to="/news" replace />;
  }

  const Content = lazy(
    postModules[key] as () => Promise<{ default: React.ComponentType }>,
  );

  return (
    <div className="flex flex-col">
      <div className="max-w-2xl mx-auto px-8 pt-10 w-full">
        <Link
          to="/news"
          className="text-xs text-muted hover:text-label transition-colors"
        >
          ← Dev Log
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="max-w-2xl mx-auto px-8 py-16 text-muted text-sm">
            Loading…
          </div>
        }
      >
        <MdxPage Content={Content} />
      </Suspense>
    </div>
  );
}
