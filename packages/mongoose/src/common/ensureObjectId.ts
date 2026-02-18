import { Types } from 'mongoose';

const EnsureObjectId = (id: string | Types.ObjectId): Types.ObjectId => {
    if (typeof id === 'string') {
        if (!Types.ObjectId.isValid(id)) {
            throw new Error('Invalid ObjectId');
        }
        return new Types.ObjectId(id);
    }
    return id;
};

export default EnsureObjectId;
