import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/client';
import ProfilePage from '../pages/ProfilePage';
import { useUserStore } from '../store/userStore';
import type { User } from '../types';

vi.mock('../api/client', () => ({
  authApi: {
    updateProfile: vi.fn(),
  },
}));

const mockUser: User = {
  id: 1,
  email: 'john@example.com',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  role: 'USER',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('ProfilePage', () => {
  const mockUpdateUser = vi.fn();

  beforeEach(() => {
    useUserStore.setState({
      user: mockUser,
      token: 'mock-token',
      isAuthenticated: true,
      updateUser: mockUpdateUser,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    useUserStore.setState({ user: null, token: null, isAuthenticated: false });
  });

  it('populates first name and last name inputs from the store user', () => {
    render(<ProfilePage />);
    expect(screen.getByPlaceholderText('First name')).toHaveValue('John');
    expect(screen.getByPlaceholderText('Last name')).toHaveValue('Doe');
  });

  it('Save button is disabled when nothing has changed', async () => {
    render(<ProfilePage />);
    // Form.useWatch settles after the first render cycle, so wait for disable
    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).toBeDisabled());
  });

  it('Save button enables after typing a different first name', async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    await waitFor(() => expect(saveBtn).toBeDisabled());

    await user.clear(screen.getByPlaceholderText('First name'));
    await user.type(screen.getByPlaceholderText('First name'), 'Jane');

    await waitFor(() => expect(saveBtn).not.toBeDisabled());
  });

  it('calls updateProfile and updateUser with updated values on Save', async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.updateProfile).mockResolvedValueOnce({
      access_token: 'new-token',
      user: { ...mockUser, firstName: 'Jane' },
    });

    render(<ProfilePage />);
    const saveBtn = screen.getByRole('button', { name: /save/i });
    await waitFor(() => expect(saveBtn).toBeDisabled());

    await user.clear(screen.getByPlaceholderText('First name'));
    await user.type(screen.getByPlaceholderText('First name'), 'Jane');
    await waitFor(() => expect(saveBtn).not.toBeDisabled());

    await user.click(saveBtn);

    await waitFor(() => {
      expect(vi.mocked(authApi.updateProfile)).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
      });
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Jane' }),
        'new-token',
      );
    });
  });
});
