import { Helmet } from "react-helmet-async";
import MdxPage from "../components/MdxPage";
import Content from "../content/terms.mdx";

export default function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Service — Candidate Chess</title>
      </Helmet>
      <MdxPage Content={Content} />
    </>
  );
}
