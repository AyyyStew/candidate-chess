import { useParams, Link, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import MdxPage from "../components/MdxPage";

interface PostMeta {
  title: string;
  description: string;
}
interface PostModule {
  meta: PostMeta;
}

const postModules = import.meta.glob("../content/posts/*.mdx");
const postMetas = import.meta.glob<PostModule>("../content/posts/*.mdx", {
  eager: true,
});

export default function NewsPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const key = `../content/posts/${slug}.mdx`;
  const meta = postMetas[key]?.meta;

  if (!postModules[key]) {
    return <Navigate to="/news" replace />;
  }

  const Content = lazy(
    postModules[key] as () => Promise<{ default: React.ComponentType }>,
  );

  return (
    <>
      {meta && (
        <Helmet>
          <title>{meta.title} — Candidate Chess</title>
          <meta name="description" content={meta.description} />
        </Helmet>
      )}
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
    </>
  );
}
