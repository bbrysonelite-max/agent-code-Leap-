import { useQuery } from '@tanstack/react-query';
import { useUser } from '@clerk/clerk-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBackend } from '../hooks/useBackend';
import LoadingSpinner from './LoadingSpinner';

export default function UserProfile() {
  const { user } = useUser();
  const backend = useBackend();

  const { data: userInfo, isLoading, error } = useQuery({
    queryKey: ['user-info'],
    queryFn: () => backend.auth.getUserInfo(),
    enabled: !!user,
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500">Not signed in</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-red-500">Error loading user info</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-3">
          {user.imageUrl ? (
            <img
              className="h-12 w-12 rounded-full"
              src={user.imageUrl}
              alt={user.fullName || 'User'}
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-lg font-medium text-white">
                {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0]?.toUpperCase() || 'U'}
              </span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {user.fullName || 'Anonymous User'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </div>
        
        {userInfo && (
          <div className="mt-4 space-y-2">
            <div className="text-xs text-gray-500">
              <strong>User ID:</strong> {userInfo.id}
            </div>
            <div className="text-xs text-gray-500">
              <strong>Email:</strong> {userInfo.email || 'Not provided'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}