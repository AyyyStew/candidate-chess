import { Helmet } from "react-helmet-async";
import MdxPage from "../components/MdxPage";
import Content from "../content/privacy.mdx";

export default function PrivacyPolicyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — Candidate Chess</title>
      </Helmet>
      <MdxPage Content={Content} />
    </>
  );
}
