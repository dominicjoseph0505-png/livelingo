import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="py-20 px-4 max-w-md mx-auto w-full text-center">
      <Card className="p-8 space-y-4">
        <div className="text-4xl font-extrabold text-[#3563E9]">404</div>
        <h1 className="text-xl font-bold text-[#20242C]">Page Not Found</h1>
        <p className="text-xs text-[#5A6270]">
          The screen or call room you are looking for does not exist or has already concluded.
        </p>
        <div className="pt-2">
          <Link to="/">
            <Button size="md" leftIcon={<Home className="w-4 h-4" />}>
              Return to LiveLingo Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};
