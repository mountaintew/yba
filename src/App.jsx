import Nav from './components/Nav.jsx';
import Hero from './components/Hero.jsx';
import HowItWorks from './components/HowItWorks.jsx';
import Report from './components/Report.jsx';
import Rules from './components/Rules.jsx';
import Faq from './components/Faq.jsx';
import Closing from './components/Closing.jsx';

export default function App() {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <Report />
        <Rules />
        <Faq />
        <Closing />
      </main>
    </>
  );
}
