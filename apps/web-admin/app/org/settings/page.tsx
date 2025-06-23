'use client'

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card, Spinner, Tabs, Table, Badge, Avatar, TableHead, TableHeadCell, TabItem, TableBody, TableRow, TableCell } from 'flowbite-react';
import { Building, Users, UserPlus, Link as LinkIcon, Trash2 } from 'lucide-react';
import InviteMemberForm from '../../components/forms/InviteMemberForm';

// Mock types
type Member = {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  avatar?: string;
};

type Invitation = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'EXPIRED';
  token: string;
};

type Organization = {
    id: string;
    name: string;
};

export default function OrgSettingsPage() {
  const searchParams = useSearchParams();
  const orgId = searchParams.get('orgId');
  
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [newlyCreatedInvite, setNewlyCreatedInvite] = useState<Invitation | null>(null);

  useEffect(() => {
    if (orgId) {
      setLoading(true);
      // Mock fetching data
      setTimeout(() => {
        setOrg({ id: orgId, name: 'Demo Organization' });
        setMembers([
          { id: '1', name: 'Demo User', email: 'demo@miot.dev', role: 'OWNER', avatar: `https://i.pravatar.cc/150?u=1` },
          { id: '2', name: 'Alice Johnson', email: 'alice@miot.dev', role: 'ADMIN', avatar: `https://i.pravatar.cc/150?u=2` },
          { id: '3', name: 'Bob Smith', email: 'bob@miot.dev', role: 'MEMBER', avatar: `https://i.pravatar.cc/150?u=3` },
        ]);
        setInvitations([
            { id: 'inv1', email: 'charlie@miot.dev', role: 'MEMBER', status: 'PENDING', token: 'demo-invitation-token' }
        ]);
        setLoading(false);
      }, 1000);
    }
  }, [orgId]);

  const handleInviteSuccess = (invitation: any) => {
    const newInvitation: Invitation = { ...invitation, status: 'PENDING' };
    setInvitations(prev => [...prev, newInvitation]);
    setNewlyCreatedInvite(newInvitation);
  };

  const getRoleBadgeColor = (role: Member['role']) => {
    switch(role) {
      case 'OWNER': return 'purple';
      case 'ADMIN': return 'info';
      case 'MEMBER': return 'gray';
      default: return 'gray';
    }
  }

  if (loading) {
    return <div className="text-center py-20"><Spinner size="xl" /></div>;
  }

  if (!org) {
    return <div className="text-center py-20">Organization not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <Building className="w-8 h-8 text-blue-500" />
          {org.name}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your organization settings, members, and invitations.
        </p>
      </div>

      <Tabs aria-label="Organization settings tabs" variant="default">
        <TabItem active title="Members" icon={Users}>
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h5 className="text-xl font-bold leading-none text-gray-900 dark:text-white">
                Team Members
              </h5>
              <Button color="blue" onClick={() => setInviteModalOpen(true)}>
                <UserPlus className="mr-2 h-5 w-5" />
                Invite Member
              </Button>
            </div>
            <Table>
              <TableHead>
                <TableHeadCell>Member</TableHeadCell>
                <TableHeadCell>Email</TableHeadCell>
                <TableHeadCell>Role</TableHeadCell>
                <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {members.map(member => (
                  <TableRow key={member.id}>
                    <TableCell className="flex items-center gap-4">
                      <Avatar img={member.avatar} rounded />
                      <span className="font-medium text-gray-900 dark:text-white">{member.name}</span>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge color={getRoleBadgeColor(member.role)}>{member.role}</Badge>
                    </TableCell>
                    <TableCell>
                      {member.role !== 'OWNER' && <Button size="xs" color="light"><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabItem>

        <TabItem title="Pending Invitations" icon={UserPlus}>
          <Card>
            <h5 className="text-xl font-bold leading-none text-gray-900 dark:text-white mb-4">
                Pending Invitations
            </h5>
            {newlyCreatedInvite && (
                <div className="p-4 mb-4 text-sm text-green-800 rounded-lg bg-green-50 dark:bg-gray-800 dark:text-green-400" role="alert">
                    <span className="font-medium">Invitation sent!</span> You can share this link with {newlyCreatedInvite.email}:<br />
                    <div className="flex items-center gap-2 mt-2">
                        <input type="text" readOnly value={`${window.location.origin}/accept-invite?token=${newlyCreatedInvite.token}`} className="bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                        <Button size="sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${newlyCreatedInvite.token}`)}>
                            <LinkIcon className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>
            )}
            <Table>
                <TableHead>
                    <TableHeadCell>Email</TableHeadCell>
                    <TableHeadCell>Role</TableHeadCell>
                    <TableHeadCell>Status</TableHeadCell>
                    <TableHeadCell><span className="sr-only">Actions</span></TableHeadCell>
                </TableHead>
                <TableBody className="divide-y">
                {invitations.map(invite => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell><Badge color="gray">{invite.role}</Badge></TableCell>
                    <TableCell><Badge color={invite.status === 'PENDING' ? 'yellow' : 'failure'}>{invite.status}</Badge></TableCell>
                    <TableCell>
                        <Button size="xs" color="light"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
            </Table>
          </Card>
        </TabItem>
      </Tabs>

      <InviteMemberForm
        isOpen={isInviteModalOpen}
        onClose={() => { setInviteModalOpen(false); setNewlyCreatedInvite(null); }}
        orgId={org.id}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
} 