import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import LandingPage from './landing/LandingPage';

export const metadata = {
  title: 'SAHAAI — Octopus Hands for the Traders | India\'s Smartest Paper Trading & Learning Platform',
  description: 'Practice ALL NSE Indices, MCX commodities & BankNifty options trading with live market data, proprietary signals with 70-80% accuracy, AI pattern recognition journal, social trading community, option heat maps, curated learning — all risk-free. India\'s first all-in-one trading intelligence platform.',
  openGraph: {
    title: 'SAHAAI — Octopus Hands for the Traders',
    description: 'India\'s smartest paper trading & learning platform for F&O traders.',
    type: 'website',
    url: 'https://sahaai.tech',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    redirect('/dashboard');
  }

  return <LandingPage />;
}
