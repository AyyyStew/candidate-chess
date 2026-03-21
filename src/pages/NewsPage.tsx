import { Link } from "react-router-dom";

interface PostMeta {
  title: string;
  date: string;
  description: string;
}

interface PostModule {
  meta: PostMeta;
}

const postModules = import.meta.glob<PostModule>("../content/posts/*.mdx", {
  eager: true,
});

const posts = Object.entries(postModules)
  .map(([path, mod]) => {
    const slug = path.replace("../content/posts/", "").replace(".mdx", "");
    return { slug, ...mod.meta };
  })
  .sort((a, b) => b.date.localeCompare(a.date));

export default function NewsPage() {
  return (
    <main className="max-w-2xl mx-auto px-8 py-16 flex flex-col gap-10">
      <h1 className="font-black text-3xl tracking-tight">Dev Log</h1>

      {posts.length === 0 ? (
        <p className="text-muted text-sm">Nothing posted yet.</p>
      ) : (
        <ul className="flex flex-col gap-8">
          {posts.map((post) => (
            <li key={post.slug} className="flex flex-col gap-1">
              <Link
                to={`/news/${post.slug}`}
                className="font-bold text-lg text-text hover:text-accent transition-colors"
              >
                {post.title}
              </Link>
              <span className="text-xs text-muted">{post.date}</span>
              <p className="text-sm text-muted leading-relaxed mt-1">
                {post.description}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
